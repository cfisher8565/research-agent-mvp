/**
 * PROMETHEUS METRICS FOR OBSERVABILITY
 * =====================================
 * Production-grade metrics collection with Prometheus
 *
 * Metrics tracked:
 * - HTTP request duration (histogram)
 * - Agent query duration (histogram)
 * - Active sessions (gauge)
 * - Tool executions (counter)
 * - Cache hits (counter)
 * - Token usage (counter)
 * - Error counts (counter)
 *
 * Endpoint: GET /metrics (Prometheus scraping format)
 */

import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

// Create registry
const register = new Registry();

// Collect default metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({
  register,
  prefix: 'research_agent_'
});

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

// Agent query duration histogram
export const agentQueryDuration = new Histogram({
  name: 'agent_query_duration_seconds',
  help: 'Duration of agent queries in seconds',
  labelNames: ['agent_type', 'status'],
  buckets: [1, 5, 10, 15, 30, 60, 90, 120],
  registers: [register]
});

// Active sessions gauge
export const activeSessions = new Gauge({
  name: 'agent_active_sessions',
  help: 'Number of active agent sessions',
  registers: [register]
});

// Tool executions counter
export const toolExecutions = new Counter({
  name: 'agent_tool_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'status'],
  registers: [register]
});

// Cache hits counter
export const cacheHits = new Counter({
  name: 'agent_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register]
});

// Token usage counter
export const tokenUsage = new Counter({
  name: 'agent_token_usage_total',
  help: 'Total token usage',
  labelNames: ['type'], // 'input' or 'output'
  registers: [register]
});

// Error counter
export const errorCount = new Counter({
  name: 'agent_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'route'],
  registers: [register]
});

// SSE connection metrics
export const sseConnections = new Gauge({
  name: 'agent_sse_connections',
  help: 'Number of active SSE connections',
  registers: [register]
});

export const sseMessages = new Counter({
  name: 'agent_sse_messages_total',
  help: 'Total number of SSE messages sent',
  labelNames: ['event_type'],
  registers: [register]
});

// MCP tool delegation metrics
export const mcpToolDelegations = new Counter({
  name: 'agent_mcp_tool_delegations_total',
  help: 'Total number of MCP tool delegations',
  labelNames: ['tool_name', 'status'],
  registers: [register]
});

// Express middleware for HTTP metrics
export function metricsMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path || 'unknown';

    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: res.statusCode
      },
      duration
    );

    // Track errors
    if (res.statusCode >= 400) {
      errorCount.inc({
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error',
        route: route
      });
    }
  });

  next();
}

// Helper functions for tracking metrics
export const metrics = {
  // Track agent query
  trackQuery: (duration: number, success: boolean) => {
    agentQueryDuration.observe(
      { agent_type: 'research', status: success ? 'success' : 'error' },
      duration / 1000
    );
  },

  // Track tool execution
  trackTool: (toolName: string, duration: number, success: boolean) => {
    toolExecutions.inc({ tool_name: toolName, status: success ? 'success' : 'error' });
  },

  // Track cache hit
  trackCacheHit: (cacheType: string = 'prompt') => {
    cacheHits.inc({ cache_type: cacheType });
  },

  // Track token usage
  trackTokens: (inputTokens: number, outputTokens: number) => {
    tokenUsage.inc({ type: 'input' }, inputTokens);
    tokenUsage.inc({ type: 'output' }, outputTokens);
  },

  // Update session count
  updateSessions: (count: number) => {
    activeSessions.set(count);
  },

  // Track SSE connection
  trackSSEConnection: (delta: number) => {
    sseConnections.inc(delta);
  },

  // Track SSE message
  trackSSEMessage: (eventType: string) => {
    sseMessages.inc({ event_type: eventType });
  },

  // Track MCP tool delegation
  trackMCPTool: (toolName: string, success: boolean) => {
    mcpToolDelegations.inc({ tool_name: toolName, status: success ? 'success' : 'error' });
  },

  // Track error
  trackError: (errorType: string, route: string) => {
    errorCount.inc({ error_type: errorType, route });
  }
};

// Export registry for /metrics endpoint
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

export { register };
export default metrics;
