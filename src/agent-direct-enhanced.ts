import axios from 'axios';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: any;
}

interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export async function runAgentWithToolsAndContext(
  prompt: string,
  sessionHistory: Message[],
  systemPrompt: string,
  contextInfo?: Record<string, any>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const mcpGatewayUrl = process.env.MCP_GATEWAY_URL!;
  const mcpSecret = process.env.MCP_SHARED_SECRET!;

  // Fetch tools based on agent type (determined by system prompt)
  const isBrowserAgent = systemPrompt.includes('Browser Automation Agent');

  let allTools: any[] = [];
  let playwrightTools: any[] = [];

  if (isBrowserAgent) {
    // BROWSER AGENT: Only Playwright tools (no research tools)
    try {
      const playwrightResponse = await axios.post(
        'http://localhost:8003/mcp',
        { jsonrpc: "2.0", method: "tools/list", id: 1 },
        { headers: { 'Content-Type': 'application/json' }, timeout: 3000 }
      );
      playwrightTools = playwrightResponse.data.result?.tools || [];
      allTools = playwrightTools;
      console.log(`[Browser Agent] Loaded ${playwrightTools.length} Playwright tools (specialized)`);
    } catch (e: any) {
      console.error(`[Browser Agent] ERROR: Playwright MCP unavailable:`, e.message);
      throw new Error('Browser Agent requires Playwright MCP on localhost:8003');
    }
  } else {
    // RESEARCH AGENT: Only research tools (no Playwright)
    const gatewayTools = await axios.post(
      mcpGatewayUrl,
      { jsonrpc: "2.0", method: "tools/list", id: 1 },
      { headers: { 'X-MCP-Secret': mcpSecret, 'Content-Type': 'application/json' } }
    );
    allTools = gatewayTools.data.result.tools;
    console.log(`[Research Agent] Loaded ${allTools.length} research tools (specialized)`);
  }

  // Transform MCP tools to Anthropic tool format
  const mcpTools: Tool[] = allTools.map((tool: any) => ({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    input_schema: tool.inputSchema || tool.input_schema || { type: 'object', properties: {} }
  }));

  console.log(`[Agent] Total tools: ${mcpTools.length} specialized tools`);

  // Build messages with session history + context
  const messages: Message[] = [];

  // Add context info if provided (from Claude Code)
  if (contextInfo && Object.keys(contextInfo).length > 0) {
    const contextDescription = Object.entries(contextInfo)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    messages.push({
      role: 'user',
      content: `[Context from Claude Code]\n${contextDescription}`
    });
  }

  // Add session history (last 10 messages for context)
  const recentHistory = sessionHistory.slice(-10);
  messages.push(...recentHistory);

  // Add current prompt
  messages.push({ role: 'user', content: prompt });

  console.log(`[Agent] Running with ${messages.length} messages (${recentHistory.length} from history)`);

  // Tool use loop
  let iterations = 0;
  const maxIterations = 15; // Increased for complex workflows

  while (iterations < maxIterations) {
    iterations++;

    console.log(`[Agent] Iteration ${iterations}, calling Claude API with ${mcpTools.length} tools...`);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-5-20250929', // Latest Sonnet 4.5 - Most powerful!
        max_tokens: 16384, // 2x standard for detailed expert responses
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' } // Prompt caching = 90% cost savings!
          }
        ],
        messages: messages,
        tools: mcpTools,
        tool_choice: { type: 'auto' }
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31', // Enable caching
          'content-type': 'application/json'
        },
        validateStatus: () => true
      }
    );

    if (response.status !== 200) {
      console.error(`[Agent] API error ${response.status}:`, JSON.stringify(response.data, null, 2));
      throw new Error(`Anthropic API returned ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const message = response.data;

    // Log cache usage (cost savings!)
    if (message.usage?.cache_creation_input_tokens) {
      console.log(`[Cache] Created: ${message.usage.cache_creation_input_tokens} tokens`);
    }
    if (message.usage?.cache_read_input_tokens) {
      console.log(`[Cache] Read: ${message.usage.cache_read_input_tokens} tokens (90% cost savings!)`);
    }

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

      console.log(`[Agent] Executing ${toolUses.length} tool calls...`);

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUses.map(async (toolUse: any) => {
          try {
            console.log(`[Tool] Calling ${toolUse.name}...`);

            // Determine if this is a Playwright tool (route to localhost:8003)
            const isPlaywrightTool = playwrightTools.some((t: any) => t.name === toolUse.name);
            const targetUrl = isPlaywrightTool ? 'http://localhost:8003/mcp' : mcpGatewayUrl;
            const headers: any = { 'Content-Type': 'application/json' };

            if (!isPlaywrightTool) {
              headers['X-MCP-Secret'] = mcpSecret;
            }

            const result = await axios.post(
              targetUrl,
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
                headers,
                timeout: 60000 // 60s timeout for slow tools
              }
            );

            console.log(`[Tool] ${toolUse.name} completed`);

            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result.data.result.content || result.data.result)
            };
          } catch (error: any) {
            console.error(`[Tool] ${toolUse.name} error:`, error.message);
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
    } else if (message.stop_reason === 'max_tokens') {
      // Response was truncated
      const textBlocks = message.content.filter((b: any) => b.type === 'text');
      const partialResult = textBlocks.map((b: any) => b.text).join('\n');
      return partialResult + '\n\n[Response truncated due to length - continue in next query]';
    } else {
      // Unexpected stop reason
      console.warn(`[Agent] Unexpected stop_reason: ${message.stop_reason}`);
      break;
    }
  }

  return `Reached maximum iterations (${maxIterations}). The task may require breaking into smaller steps.`;
}
