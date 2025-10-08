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

    // Call Claude Agent SDK with ALL MCP servers: Context7, Perplexity, BrightData
    // Context optimized: only capture final result message
    let finalResult = 'No result available';

    for await (const message of query({
      prompt,
      options: {
        // Full tool access - bypass all permission checks
        permissionMode: 'bypassPermissions',

        mcpServers: {
          // Context7 - Library documentation
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@context7/mcp-server'],
            env: {
              CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY || ''
            }
          },
          // Perplexity - AI-powered research
          perplexity: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@perplexity/mcp-server'],
            env: {
              PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || ''
            }
          },
          // BrightData - Web scraping and SERP
          brightdata: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@brightdata/mcp@latest'],
            env: {
              API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || '',
              MCP_UNLOCKER: process.env.BRIGHTDATA_API_TOKEN || '',
              MCP_BROWSER: process.env.BRIGHTDATA_API_TOKEN || ''
            }
          }
        }
        // No allowedTools = all tools available
        // permissionMode: 'bypassPermissions' = no permission prompts
      }
    })) {
      // Context optimization: only capture the final result message
      // This is the actual result from the SDK, not streaming tokens
      if (message.type === 'result' && message.subtype === 'success') {
        finalResult = (message as any).result;
        console.log('[Agent] Final result captured');
        break; // Exit immediately after getting result
      }
    }

    console.log(`[Query] Completed`);

    res.json({
      success: true,
      data: {
        result: finalResult
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
