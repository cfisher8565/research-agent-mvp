import express, { Request, Response } from 'express';
import { runAgentWithToolsAndContext } from './agent-direct-enhanced';
import { sessionManager } from './session-manager-redis'; // Use Redis session manager
import { RESEARCH_AGENT_SYSTEM_PROMPT } from './system-prompts';
import { sseConnectionManager } from './sse/connection-manager';
import { handleQueryStream, handleSSEStats } from './sse/endpoints';
import axios from 'axios';

// Security middleware
import { authenticateJWT } from './middleware/auth';
import { limiter } from './middleware/rate-limit';

// Observability
import { log, requestLoggingMiddleware } from './logger';
import { metrics, metricsMiddleware, getMetrics } from './metrics';

const app = express();
const PORT = Number(process.env.PORT) || 8080;

// Timeout configuration (DigitalOcean App Platform load balancer timeout handling)
// Increased from 25s to 120s to allow complex browser automation to complete
const TIMEOUTS = {
  QUERY_TOTAL: 120000,  // 120 seconds (2 minutes for complex browser tasks)
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

// Apply observability middleware
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);

// Apply rate limiting to all routes (public endpoints will be skipped in rate-limit.ts)
app.use(limiter);

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

  // Check Redis health
  const redisHealthy = await sessionManager.healthCheck();
  const redisInfo = sessionManager.getConnectionInfo();

  res.json({
    status: 'healthy',
    agent: 'research-mvp',
    mcp: mcpStatus,
    redis: {
      connected: redisHealthy,
      ...redisInfo
    },
    sessions: await sessionManager.stats(),
    timestamp: new Date().toISOString()
  });
});

// Session management endpoints
app.get('/sessions', async (req: Request, res: Response) => {
  const stats = await sessionManager.stats();
  res.json(stats);
});

app.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  await sessionManager.clear(req.params.sessionId);
  res.json({ success: true, message: 'Session cleared' });
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

// Main query endpoint with session management and context awareness
// NO JWT authentication - hooks are trusted internal calls (CLAUDE.md Rule #4)
app.post('/query', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { prompt, sessionId, context } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    // Use sessionId or generate one
    const sid = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Query] Session: ${sid}, Prompt: ${prompt.substring(0, 100)}...`);

    // Update session context if provided (from Claude Code) - async for Redis
    if (context) {
      await sessionManager.updateContext(sid, context);
      console.log(`[Session] Context updated:`, Object.keys(context));
    }

    // Get session history for multi-turn conversations - async for Redis
    const history = await sessionManager.getHistory(sid);
    const sessionContext = await sessionManager.getContext(sid);

    console.log(`[Session] History: ${history.length} messages, Context keys: ${Object.keys(sessionContext).length}`);

    // Add user message to session - async for Redis
    await sessionManager.addMessage(sid, 'user', prompt);

    // Call agent with full context
    console.log(`[Query] Running Research Agent with session context...`);

    const finalResult = await runAgentWithToolsAndContext(
      prompt,
      history,
      RESEARCH_AGENT_SYSTEM_PROMPT,
      sessionContext
    );

    // Add assistant response to session - async for Redis
    await sessionManager.addMessage(sid, 'assistant', finalResult);

    const elapsed = Date.now() - startTime;
    console.log(`[Query] Completed in ${elapsed}ms`);

    res.json({
      success: true,
      data: {
        result: finalResult,
        sessionId: sid
      },
      metadata: {
        elapsed_ms: elapsed,
        historyLength: history.length + 2 // +2 for current exchange
      }
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Error] Query failed after ${elapsed}ms`);
    console.error(`[Error] Message:`, error.message);
    console.error(`[Error] Stack:`, error.stack);

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      metadata: {
        elapsed_ms: elapsed
      }
    });
  }
});

// SSE streaming query endpoint - provides real-time progress updates
// NO JWT authentication - hooks are trusted internal calls (CLAUDE.md Rule #4)
app.post('/query/stream', handleQueryStream);

// SSE stats endpoint
app.get('/sse/stats', handleSSEStats);

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(await getMetrics());
  } catch (error: any) {
    log.error('Failed to generate metrics', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// MCP Tool Delegation Endpoint (Route 2)
// Accepts direct MCP tool calls from the hook and executes them via MCP client
app.post('/research/mcp-tool', authenticateJWT, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { toolName, toolInput, sessionId } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: toolName'
      });
    }

    log.info('MCP tool delegation', { toolName, sessionId });

    // Use sessionId or generate one
    const sid = sessionId || `mcp-tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Execute the tool via MCP client (using runAgentWithToolsAndContext)
    // The agent will automatically use the requested tool based on the prompt
    const toolPrompt = `Execute the MCP tool: ${toolName} with input: ${JSON.stringify(toolInput)}`;

    const history = await sessionManager.getHistory(sid);
    const sessionContext = await sessionManager.getContext(sid);

    log.debug('Executing MCP tool via agent', { toolName, historyLength: history.length });

    const result = await runAgentWithToolsAndContext(
      toolPrompt,
      history,
      RESEARCH_AGENT_SYSTEM_PROMPT,
      sessionContext
    );

    const elapsed = Date.now() - startTime;

    // Track metrics
    metrics.trackMCPTool(toolName, true);
    metrics.trackQuery(elapsed, true);

    log.info('MCP tool delegation completed', { toolName, sessionId: sid, duration: elapsed });

    res.json({
      success: true,
      result: result,
      metadata: {
        elapsed_ms: elapsed,
        sessionId: sid,
        toolName: toolName
      }
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    log.error('MCP tool delegation failed', error);

    metrics.trackMCPTool(req.body.toolName || 'unknown', false);
    metrics.trackQuery(elapsed, false);

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      metadata: {
        elapsed_ms: elapsed
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
  console.log(`📍 Query (blocking): http://localhost:${PORT}/query`);
  console.log(`📍 Query (streaming): http://localhost:${PORT}/query/stream`);
  console.log(`📍 SSE Stats: http://localhost:${PORT}/sse/stats`);
  console.log(`⏱️  Query Timeout: ${TIMEOUTS.QUERY_TOTAL}ms`);
});

// Configure HTTP server timeouts to prevent load balancer 503 errors
// These must be >= application timeouts to allow queries to complete
server.setTimeout(120000);        // 120 seconds - overall socket timeout
server.keepAliveTimeout = 120000; // 120 seconds - keep connection alive during processing
server.headersTimeout = 125000;   // 125 seconds - slightly more than keepAlive (recommended)

console.log(`⏱️  Server Timeouts: socket=120s, keepAlive=120s, headers=125s`);

// Graceful shutdown handling for SSE connections
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, starting graceful shutdown...');
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed (no new connections)');
  });

  // Close all active SSE connections gracefully
  console.log(`Closing ${sseConnectionManager.getActiveCount()} active SSE connections...`);
  sseConnectionManager.closeAll();

  // Wait a bit for cleanup
  setTimeout(() => {
    console.log('Graceful shutdown complete');
    process.exit(0);
  }, 5000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  sseConnectionManager.closeAll();
  process.exit(0);
});
