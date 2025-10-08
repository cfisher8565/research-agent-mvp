import express, { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { withTimeout } from './utils/timeout';

const app = express();
const PORT = process.env.PORT || 8080;

// Timeout configuration (DigitalOcean App Platform has 60s load balancer timeout)
const TIMEOUTS = {
  QUERY_TOTAL: 25000,  // 25 seconds (leave 5s buffer for DO gateway timeout at 30s)
};

// Global error handlers
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
  // Don't exit in production - let health checks handle it
});

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  // Check required environment variables
  const mcpStatus = {
    success: !!(process.env.MCP_GATEWAY_URL && process.env.MCP_SHARED_SECRET),
    configured: {
      gateway: !!process.env.MCP_GATEWAY_URL,
      sharedSecret: !!process.env.MCP_SHARED_SECRET
    }
  };

  res.json({
    status: 'healthy',
    agent: 'research-mvp',
    mcp: mcpStatus,
    timestamp: new Date().toISOString()
  });
});

// Main query endpoint with timeout protection
app.post('/query', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    console.log(`[Query] Received: ${prompt.substring(0, 100)}...`);

    // Call Claude Agent SDK with native HTTP MCP support
    let finalResult = 'No result available';

    const queryIterator = query({
      prompt: prompt,
      options: {
        // Simplified system prompt - native HTTP MCP support
        systemPrompt: `You are a specialized Research Agent with expert knowledge of three powerful research tools:

1. **Context7** (@context7/mcp-server): Library documentation lookup
   - Use to find official API docs, code examples, and version-specific documentation
   - Tools: mcp__context7__resolve-library-id, mcp__context7__get-library-docs
   - Example: "Use Context7 to get TanStack Query v5 mutations documentation"

2. **Perplexity** (@perplexity-ai/mcp-server): AI-powered web research with citations
   - Tools: perplexity_search (quick search), perplexity_ask (general Q&A), perplexity_research (deep research), perplexity_reason (complex analysis)
   - Use for latest best practices, breaking changes, comparisons, current trends
   - Example: "Use Perplexity perplexity_research to find Next.js 14 App Router patterns"

3. **BrightData** (@brightdata/mcp): Web scraping and search engine results
   - Tools: mcp__brightdata__search_engine, mcp__brightdata__scrape_as_markdown, mcp__brightdata__scrape_batch, mcp__brightdata__search_engine_batch
   - Use to scrape documentation pages, extract tutorials, batch process URLs
   - Example: "Use BrightData scrape_as_markdown to extract content from https://nextjs.org/docs"

**Your research methodology:**
1. Understand the query and determine which tool(s) are most appropriate
2. Use Context7 for official documentation and API references
3. Use Perplexity for research-backed analysis and latest information with citations
4. Use BrightData for scraping specific webpages or search results
5. Combine results from multiple sources when comprehensive research is needed
6. Always cite sources and provide code examples when available
7. For large responses (>10MB markdown), BrightData saves to /tmp files - read them
8. Return final synthesized research findings in clear, structured format

Be thorough, cite sources, and leverage all three tools optimally.`,

        // Full tool access - bypass all permission checks
        permissionMode: 'bypassPermissions',

        // Native HTTP MCP support (Claude Agent SDK Oct 1, 2025+)
        // Single gateway aggregates all MCP tools (Context7, Perplexity, BrightData)
        mcpServers: {
          "mcp-gateway": {
            type: "http",
            url: process.env.MCP_GATEWAY_URL || "https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp",
            headers: {
              "X-MCP-Secret": process.env.MCP_SHARED_SECRET || ""
            }
          }
        }
      }
    });

    // Wrap with timeout protection
    const timeoutIterator = withTimeout(
      queryIterator,
      TIMEOUTS.QUERY_TOTAL,
      () => {
        console.log(`[Query] Timeout triggered after ${TIMEOUTS.QUERY_TOTAL}ms, aborting...`);
      }
    );

    // Iterate with timeout protection
    for await (const message of timeoutIterator) {
      // Context optimization: only capture the final result message
      if (message.type === 'result' && message.subtype === 'success') {
        finalResult = (message as any).result;
        console.log('[Agent] Final result captured');
        break;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Query] Completed successfully in ${elapsed}ms`);

    res.json({
      success: true,
      data: {
        result: finalResult
      },
      metadata: {
        elapsed_ms: elapsed
      }
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Error] Query failed after ${elapsed}ms:`, error);

    // Distinguish timeout errors from other errors
    const isTimeout = error.message?.includes('timed out');
    const statusCode = isTimeout ? 408 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal server error',
      type: isTimeout ? 'timeout' : 'error',
      metadata: {
        elapsed_ms: elapsed,
        timeout_threshold_ms: isTimeout ? TIMEOUTS.QUERY_TOTAL : undefined
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Research Agent MVP running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Query:  http://localhost:${PORT}/query`);
  console.log(`⏱️  Query Timeout: ${TIMEOUTS.QUERY_TOTAL}ms`);
});
