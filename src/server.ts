import express, { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { withTimeout } from './utils/timeout';
import axios from 'axios';

const app = express();
const PORT = Number(process.env.PORT) || 8080;

// Timeout configuration (DigitalOcean App Platform load balancer timeout handling)
// Increased from 25s to 120s to allow complex queries to complete
const TIMEOUTS = {
  QUERY_TOTAL: 120000,  // 120 seconds (2 minutes for complex research tasks)
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

// SSE header injection middleware for DigitalOcean nginx
// CRITICAL: Prevents nginx from buffering SSE responses which causes 504 timeouts
app.use((req, res, next) => {
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function(statusCode: number, reasonPhrase?: any, headers?: any) {
    // Handle both (statusCode, headers) and (statusCode, reasonPhrase, headers) signatures
    let finalHeaders = headers || (typeof reasonPhrase === 'object' ? reasonPhrase : {});

    // Inject critical SSE headers for DigitalOcean nginx
    finalHeaders['X-Accel-Buffering'] = 'no';  // Critical for DO nginx - prevents buffering
    finalHeaders['Cache-Control'] = finalHeaders['Cache-Control'] || 'no-cache, no-transform';
    finalHeaders['Connection'] = finalHeaders['Connection'] || 'keep-alive';

    if (headers) {
      return originalWriteHead(statusCode, reasonPhrase, finalHeaders);
    } else {
      return originalWriteHead(statusCode, finalHeaders);
    }
  };
  next();
});

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

// Test direct Anthropic API without SDK overhead
app.post('/test-api', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    console.log(`[API Test] Starting direct Anthropic API call...`);

    // Direct API call without SDK
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || ''
        },
        timeout: 20000,
        validateStatus: () => true
      }
    );

    const elapsed = Date.now() - startTime;

    console.log(`[API Test] Response received in ${elapsed}ms, status: ${response.status}`);

    res.json({
      success: response.status === 200,
      status: response.status,
      data: response.data,
      metadata: {
        elapsed_ms: elapsed
      }
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[API Test] Failed after ${elapsed}ms:`, error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      response: error.response?.data,
      metadata: {
        elapsed_ms: elapsed
      }
    });
  }
});

// Test MCP gateway connectivity
app.get('/test-mcp', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log(`[MCP Test] Testing gateway connectivity...`);

    // BUGFIX: Correct typo in environment variable (health-infrastructure → mcp-infrastructure)
    let mcpUrl = process.env.MCP_GATEWAY_URL || "https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp";

    // Fix typo if present
    if (mcpUrl.includes('health-infrastructure')) {
      console.warn('[MCP Test] Detected typo in MCP_GATEWAY_URL, correcting...');
      mcpUrl = mcpUrl.replace('health-infrastructure', 'mcp-infrastructure');
    }

    // Test health endpoint
    const healthUrl = mcpUrl.replace(/\/mcp$/, '/health');
    const healthResponse = await axios.get(healthUrl, {
      timeout: 5000,
      validateStatus: () => true
    });

    console.log(`[MCP Test] Health status: ${healthResponse.status}`);

    // Test MCP tools/list with auth
    const mcpResponse = await axios.post(
      mcpUrl,
      {
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Secret': process.env.MCP_SHARED_SECRET || ''
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    console.log(`[MCP Test] Tools response status: ${mcpResponse.status}`);

    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      health: {
        status: healthResponse.status,
        data: healthResponse.data
      },
      mcp: {
        status: mcpResponse.status,
        data: mcpResponse.data,
        toolCount: mcpResponse.data?.result?.tools?.length || 0
      },
      metadata: {
        elapsed_ms: elapsed,
        gatewayUrl: mcpUrl
      }
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[MCP Test] Failed after ${elapsed}ms:`, error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      metadata: {
        elapsed_ms: elapsed
      }
    });
  }
});

// Debug endpoint - validate environment and MCP connectivity
app.get('/debug', async (req: Request, res: Response) => {
  const fs = await import('fs');
  const { spawn } = await import('child_process');
  const path = await import('path');

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      home: process.env.HOME,
      nodeEnv: process.env.NODE_ENV
    },
    apiKeys: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      mcpSecret: !!process.env.MCP_SHARED_SECRET
    },
    mcp: {
      gatewayUrl: process.env.MCP_GATEWAY_URL,
      configured: !!process.env.MCP_GATEWAY_URL
    },
    filesystem: {
      tmpExists: fs.existsSync('/tmp'),
      tmpWritable: false,
      claudeDirExists: fs.existsSync('/app/.claude'),
      homeWritable: false
    }
  };

  // Test filesystem write permissions
  try {
    fs.writeFileSync('/tmp/test.txt', 'test');
    fs.unlinkSync('/tmp/test.txt');
    diagnostics.filesystem.tmpWritable = true;
  } catch (e: any) {
    diagnostics.filesystem.tmpError = e.message;
  }

  try {
    fs.writeFileSync('/app/.claude/test.txt', 'test');
    fs.unlinkSync('/app/.claude/test.txt');
    diagnostics.filesystem.homeWritable = true;
  } catch (e: any) {
    diagnostics.filesystem.homeError = e.message;
  }

  // Test cli.js spawn
  const cliPath = path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');
  diagnostics.cli = {
    cliJsExists: fs.existsSync(cliPath),
    cliJsPath: cliPath,
    spawnTest: 'not_run'
  };

  if (diagnostics.cli.cliJsExists) {
    await new Promise<void>((resolve) => {
      const child = spawn('node', [cliPath, '--version'], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        diagnostics.cli.spawnTest = {
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        };
        resolve();
      });

      setTimeout(() => {
        child.kill();
        diagnostics.cli.spawnTest = { timeout: true };
        resolve();
      }, 5000);
    });
  }

  res.json(diagnostics);
});

// Main query endpoint with timeout protection
app.post('/query', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // CRITICAL FIX: Clean debugger environment variables that interfere with subprocess
  // GitHub Issue #4619: VSCode debugger variables cause "exit code 1" failures
  const originalNodeOptions = process.env.NODE_OPTIONS;
  const originalVscodeOptions = process.env.VSCODE_INSPECTOR_OPTIONS;

  // Declare variables outside try block for error handler access
  let messageCount = 0;

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    console.log(`[Query] Received: ${prompt.substring(0, 100)}...`);

    // Clean debugger variables before SDK subprocess spawn
    delete process.env.NODE_OPTIONS;
    delete process.env.VSCODE_INSPECTOR_OPTIONS;

    console.log(`[Query] Environment check:`, {
      apiKey: !!process.env.ANTHROPIC_API_KEY,
      mcpGateway: !!process.env.MCP_GATEWAY_URL,
      mcpSecret: !!process.env.MCP_SHARED_SECRET,
      home: process.env.HOME,
      cwd: process.cwd(),
      cleanedDebugVars: {
        nodeOptions: originalNodeOptions ? 'removed' : 'not set',
        vscodeOptions: originalVscodeOptions ? 'removed' : 'not set'
      }
    });

    // Call Claude Agent SDK with native HTTP MCP support
    let finalResult = 'No result available';

    console.log(`[Query] Initializing Claude Agent SDK...`);

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
            // BUGFIX: Correct typo in environment variable
            url: (process.env.MCP_GATEWAY_URL || "https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp")
              .replace('health-infrastructure', 'mcp-infrastructure'),
            headers: {
              "X-MCP-Secret": process.env.MCP_SHARED_SECRET || ""
            }
          }
        }
      }
    });

    // Wrap with timeout protection
    console.log(`[Query] Wrapping with ${TIMEOUTS.QUERY_TOTAL}ms timeout...`);
    const timeoutIterator = withTimeout(
      queryIterator,
      TIMEOUTS.QUERY_TOTAL,
      () => {
        console.log(`[Query] Timeout triggered after ${TIMEOUTS.QUERY_TOTAL}ms, aborting...`);
      }
    );

    // Iterate with timeout protection and enhanced logging
    console.log(`[Query] Starting iteration...`);
    let lastYieldTime = Date.now();

    for await (const message of timeoutIterator) {
      const now = Date.now();
      const timeSinceLastYield = now - lastYieldTime;
      messageCount++;

      console.log(`[Agent] Message #${messageCount} (after ${timeSinceLastYield}ms):`, {
        type: message.type,
        subtype: (message as any).subtype,
        hasResult: !!(message as any).result,
        elapsedTotal: now - startTime
      });

      if (timeSinceLastYield > 8000) {
        console.warn(`[Agent] Slow yield detected: ${timeSinceLastYield}ms between messages`);
      }

      lastYieldTime = now;

      // Context optimization: only capture the final result message
      if (message.type === 'result' && message.subtype === 'success') {
        finalResult = (message as any).result;
        console.log('[Agent] Final result captured, length:', finalResult.length);
        break;
      }

      if (message.type === 'stream_event') {
        const streamEvent = message as any;
        if (streamEvent.event?.type === 'error') {
          console.error('[Agent] Stream error event:', streamEvent.event);
        }
      }
    }

    console.log(`[Query] Iterator completed. Total messages: ${messageCount}`);

    const elapsed = Date.now() - startTime;
    console.log(`[Query] Completed successfully in ${elapsed}ms`);

    // Restore original environment variables
    if (originalNodeOptions) process.env.NODE_OPTIONS = originalNodeOptions;
    if (originalVscodeOptions) process.env.VSCODE_INSPECTOR_OPTIONS = originalVscodeOptions;

    res.json({
      success: true,
      data: {
        result: finalResult
      },
      metadata: {
        elapsed_ms: elapsed,
        messageCount: messageCount
      }
    });

  } catch (error: any) {
    // Restore original environment variables on error too
    if (originalNodeOptions) process.env.NODE_OPTIONS = originalNodeOptions;
    if (originalVscodeOptions) process.env.VSCODE_INSPECTOR_OPTIONS = originalVscodeOptions;
    const elapsed = Date.now() - startTime;
    console.error(`[Error] Query failed after ${elapsed}ms`);
    console.error(`[Error] Message:`, error.message);
    console.error(`[Error] Name:`, error.name);
    console.error(`[Error] Stack:`, error.stack);

    // Log additional context for SDK errors
    if (error.message?.includes('Claude Code process')) {
      console.error(`[Error] SDK subprocess failure detected`);
      console.error(`[Error] Check if cli.js can access ANTHROPIC_API_KEY`);
      console.error(`[Error] Check if HOME directory is writable`);
    }

    // Distinguish timeout errors from other errors
    const isTimeout = error.message?.includes('timed out');
    const statusCode = isTimeout ? 408 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal server error',
      type: isTimeout ? 'timeout' : 'error',
      metadata: {
        elapsed_ms: elapsed,
        timeout_threshold_ms: isTimeout ? TIMEOUTS.QUERY_TOTAL : undefined,
        messageCount: messageCount
      }
    });
  }
});

// Start server
// CRITICAL: Bind to 0.0.0.0 for container networking (not localhost)
// Containers need to listen on all interfaces for load balancer connectivity
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Research Agent MVP running on port ${PORT}`);
  console.log(`📍 Listening on 0.0.0.0:${PORT} (all network interfaces)`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Debug:  http://localhost:${PORT}/debug`);
  console.log(`📍 Test API: http://localhost:${PORT}/test-api`);
  console.log(`📍 Test MCP: http://localhost:${PORT}/test-mcp`);
  console.log(`📍 Query:  http://localhost:${PORT}/query`);
  console.log(`⏱️  Query Timeout: ${TIMEOUTS.QUERY_TOTAL}ms`);
});

// Configure HTTP server timeouts to prevent load balancer 503 errors
// These must be >= application timeouts to allow queries to complete
server.setTimeout(120000);        // 120 seconds - overall socket timeout
server.keepAliveTimeout = 120000; // 120 seconds - keep connection alive during processing
server.headersTimeout = 125000;   // 125 seconds - slightly more than keepAlive (recommended)

console.log(`⏱️  Server Timeouts: socket=120s, keepAlive=120s, headers=125s`);
