import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: any;
}

interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export async function runAgentWithTools(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const mcpGatewayUrl = process.env.MCP_GATEWAY_URL!;
  const mcpSecret = process.env.MCP_SHARED_SECRET!;

  // Fetch available tools from MCP Gateway
  const toolsResponse = await axios.post(
    mcpGatewayUrl,
    { jsonrpc: "2.0", method: "tools/list", id: 1 },
    { headers: { 'X-MCP-Secret': mcpSecret, 'Content-Type': 'application/json' } }
  );

  // Transform MCP tools to Anthropic tool format
  const mcpTools: Tool[] = toolsResponse.data.result.tools.map((tool: any) => ({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    input_schema: tool.inputSchema || tool.input_schema || { type: 'object', properties: {} }
  }));

  // Start conversation
  const messages: Message[] = [{ role: 'user', content: prompt }];

  // Tool use loop
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;

    console.log(`[Agent] Iteration ${iterations}, sending request with ${mcpTools.length} tools...`);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: messages,
        tools: mcpTools,
        tool_choice: { type: 'auto' }
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        validateStatus: () => true  // Don't throw on 400
      }
    );

    if (response.status !== 200) {
      console.error(`[Agent] API error ${response.status}:`, JSON.stringify(response.data, null, 2));
      throw new Error(`Anthropic API returned ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const message = response.data;

    // Add assistant response to conversation
    messages.push({ role: 'assistant', content: message.content });

    // Check if done
    if (message.stop_reason === 'end_turn') {
      // Extract text from content blocks
      const textBlocks = message.content.filter((b: any) => b.type === 'text');
      return textBlocks.map((b: any) => b.text).join('\n');
    }

    // Handle tool use
    if (message.stop_reason === 'tool_use') {
      const toolUses = message.content.filter((b: any) => b.type === 'tool_use');

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUses.map(async (toolUse: any) => {
          try {
            const result = await axios.post(
              mcpGatewayUrl,
              {
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                  name: toolUse.name,
                  arguments: toolUse.input
                },
                id: 1
              },
              {
                headers: { 'X-MCP-Secret': mcpSecret, 'Content-Type': 'application/json' },
                timeout: 30000
              }
            );

            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result.data.result.content || result.data.result)
            };
          } catch (error: any) {
            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              is_error: true,
              content: `Tool error: ${error.message}`
            };
          }
        })
      );

      // Add tool results to conversation
      messages.push({ role: 'user', content: toolResults });
    } else {
      // Unexpected stop reason
      break;
    }
  }

  return 'Max iterations reached';
}
