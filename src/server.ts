import express, { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    agent: 'research-mvp',
    timestamp: new Date().toISOString()
  });
});

// Main query endpoint
app.post('/query', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    console.log(`[Query] Received: ${prompt}`);

    // Call Claude Agent SDK with Context7 MCP server
    const messages: any[] = [];

    for await (const message of query({
      prompt,
      options: {
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@context7/mcp-server']
          }
        },
        allowedTools: [
          'mcp__context7__resolve-library-id',
          'mcp__context7__get-library-docs'
        ]
      }
    })) {
      messages.push(message);

      // Log progress
      if (message.type === 'assistant') {
        console.log('[Agent] Assistant message received');
      }
    }

    // Extract final result
    const lastMessage = messages[messages.length - 1];
    const result = lastMessage?.type === 'result'
      ? lastMessage.result
      : 'No result available';

    console.log(`[Query] Completed successfully`);

    res.json({
      success: true,
      data: {
        result,
        messageCount: messages.length
      }
    });

  } catch (error: any) {
    console.error('[Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Research Agent MVP running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Query:  http://localhost:${PORT}/query`);
});
