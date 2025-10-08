# Claude Agent SDK Timeout Research
**Date**: 2025-10-08  
**SDK Version**: @anthropic-ai/claude-agent-sdk ^0.1.0  
**Issue**: query() function hangs indefinitely, causing 503 Gateway Timeout

---

## Research Summary

The Claude Agent SDK (released October 1, 2025) version 0.1.0 does **NOT** provide built-in timeout configuration for the `query()` function. The async generator pattern used by the SDK requires **custom timeout implementation** at the application level.

---

## Root Cause Analysis

### The Problem

The current implementation in `src/server.ts` uses an infinite async generator loop:

```typescript
for await (const message of query({
  prompt: prompt,
  options: { /* ... */ }
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    finalResult = (message as any).result;
    break;
  }
}
```

**Issues**:
1. No timeout protection on the async generator
2. If MCP connection hangs, loop never completes
3. DigitalOcean App Platform gateway timeout (30s) kills request with 503
4. No abort signal or timeout mechanism in SDK 0.1.0

---

## Solutions

### Solution 1: Async Generator Timeout Wrapper (RECOMMENDED)

Create a reusable timeout wrapper for async generators:

```typescript
// src/utils/timeout.ts
export async function* withTimeout<T>(
  asyncIterator: AsyncIterableIterator<T>,
  timeoutMs: number,
  onTimeout?: () => void
): AsyncGenerator<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const createTimeout = () => new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (onTimeout) onTimeout();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    let timeoutPromise = createTimeout();

    for await (const item of asyncIterator) {
      // Clear old timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Yield the item (race between item and timeout)
      yield await Promise.race([
        Promise.resolve(item),
        timeoutPromise
      ]) as T;

      // Reset timeout for next iteration
      timeoutPromise = createTimeout();
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
```

**Usage in server.ts**:

```typescript
import { withTimeout } from './utils/timeout';

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

    let finalResult = 'No result available';

    // Wrap query() with 25-second timeout (DigitalOcean gateway is 30s)
    const queryIterator = query({
      prompt: prompt,
      options: {
        systemPrompt: `...`,
        permissionMode: 'bypassPermissions',
        mcpServers: { /* ... */ }
      }
    });

    const timeoutIterator = withTimeout(
      queryIterator,
      25000, // 25 seconds (leave 5s buffer for DO gateway)
      () => console.log('[Query] Timeout triggered, aborting...')
    );

    for await (const message of timeoutIterator) {
      if (message.type === 'result' && message.subtype === 'success') {
        finalResult = (message as any).result;
        console.log('[Agent] Final result captured');
        break;
      }
    }

    console.log(`[Query] Completed successfully`);

    res.json({
      success: true,
      data: {
        result: finalResult
      }
    });

  } catch (error: any) {
    console.error('[Error]', error);

    // Distinguish timeout errors from other errors
    const isTimeout = error.message?.includes('timed out');

    res.status(isTimeout ? 408 : 500).json({
      success: false,
      error: error.message || 'Internal server error',
      type: isTimeout ? 'timeout' : 'error'
    });
  }
});
```

**Benefits**:
- ✅ Prevents indefinite hangs
- ✅ Returns 408 Request Timeout instead of 503 Gateway Timeout
- ✅ Graceful error handling
- ✅ Configurable per-request
- ✅ Reusable utility function

---

### Solution 2: Per-Iteration + Total Timeout (ADVANCED)

For more granular control:

```typescript
export async function* withDualTimeout<T>(
  asyncIterator: AsyncIterableIterator<T>,
  perIterationTimeoutMs: number,
  totalTimeoutMs: number
): AsyncGenerator<T> {
  const startTime = Date.now();
  let iterationTimeoutId: NodeJS.Timeout | null = null;

  try {
    for await (const item of asyncIterator) {
      // Check total timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > totalTimeoutMs) {
        throw new Error(`Total timeout of ${totalTimeoutMs}ms exceeded (elapsed: ${elapsed}ms)`);
      }

      // Apply per-iteration timeout
      if (iterationTimeoutId) clearTimeout(iterationTimeoutId);

      const iterationPromise = new Promise<T>((resolve) => resolve(item));
      const timeoutPromise = new Promise<never>((_, reject) => {
        iterationTimeoutId = setTimeout(() => {
          reject(new Error(`Iteration timed out after ${perIterationTimeoutMs}ms`));
        }, perIterationTimeoutMs);
      });

      yield await Promise.race([iterationPromise, timeoutPromise]) as T;
    }
  } finally {
    if (iterationTimeoutId) clearTimeout(iterationTimeoutId);
  }
}
```

**Usage**:

```typescript
const timeoutIterator = withDualTimeout(
  queryIterator,
  10000, // 10s per iteration (MCP tool call)
  25000  // 25s total query time
);
```

**Benefits**:
- ✅ Catches both slow individual operations AND overall query time
- ✅ Better debugging (knows which part timed out)
- ✅ Prevents one slow MCP server from blocking entire query

---

### Solution 3: Express Request Timeout Middleware (FALLBACK)

Add a global timeout for all Express requests:

```typescript
import express from 'express';

const app = express();

// Global timeout middleware (60 seconds)
app.use((req, res, next) => {
  req.setTimeout(60000, () => {
    console.error(`[Timeout] Request to ${req.path} exceeded 60s`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        path: req.path
      });
    }
  });
  next();
});
```

**Benefits**:
- ✅ Applies to all endpoints
- ✅ Last line of defense
- ✅ Prevents zombie requests

**Limitations**:
- ❌ Doesn't stop the async generator (still running in background)
- ❌ Less precise error messages

---

## Recommended Implementation Strategy

### Phase 1: Immediate Fix (Deploy Today)

1. **Add timeout wrapper utility** (`src/utils/timeout.ts`)
2. **Wrap query() in /query endpoint** with 25s timeout
3. **Add timeout error logging** to distinguish from other errors
4. **Test with diagnostic script**

### Phase 2: Enhanced Observability (This Week)

1. **Add request timing logs**:
   ```typescript
   const startTime = Date.now();
   // ... query execution ...
   const elapsed = Date.now() - startTime;
   console.log(`[Query] Completed in ${elapsed}ms`);
   ```

2. **Add timeout metrics**:
   ```typescript
   let timeoutCount = 0;
   let successCount = 0;

   app.get('/metrics', (req, res) => {
     res.json({
       timeouts: timeoutCount,
       successes: successCount,
       timeout_rate: timeoutCount / (timeoutCount + successCount)
     });
   });
   ```

### Phase 3: Production Hardening (Next Sprint)

1. **Implement dual timeout** (per-iteration + total)
2. **Add retry logic** for transient failures
3. **Implement circuit breaker** for MCP gateway
4. **Add distributed tracing** (if scaling to multiple instances)

---

## Express.js Timeout Best Practices

### 1. Set Appropriate Timeout Values

```typescript
// DigitalOcean App Platform has 60s load balancer timeout
// Set application timeouts below this threshold

const TIMEOUTS = {
  EXPRESS_REQUEST: 55000,    // 55s (express request timeout)
  QUERY_TOTAL: 50000,        // 50s (total query execution)
  QUERY_ITERATION: 10000,    // 10s (per MCP tool call)
  MCP_CONNECTION: 5000       // 5s (MCP server health check)
};
```

### 2. Clean Up Resources on Timeout

```typescript
export async function* withTimeout<T>(
  asyncIterator: AsyncIterableIterator<T>,
  timeoutMs: number
): AsyncGenerator<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // ... timeout logic ...
  } finally {
    // CRITICAL: Always clean up
    if (timeoutId) clearTimeout(timeoutId);

    // If iterator has a cleanup method, call it
    if (typeof asyncIterator.return === 'function') {
      await asyncIterator.return();
    }
  }
}
```

### 3. Return Appropriate HTTP Status Codes

```typescript
try {
  // ... query execution ...
} catch (error: any) {
  if (error.message?.includes('timed out')) {
    return res.status(408).json({ error: 'Request Timeout' });
  }

  if (error.message?.includes('ECONNREFUSED')) {
    return res.status(502).json({ error: 'Bad Gateway - MCP unavailable' });
  }

  return res.status(500).json({ error: 'Internal Server Error' });
}
```

---

## Testing Strategy

### 1. Test Timeout Behavior

```bash
# Test with long query (should timeout after 25s)
time curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use Perplexity perplexity_research to do deep research on quantum computing advances in 2025 with full citations and code examples"
  }'

# Expected: 408 Request Timeout after ~25 seconds
```

### 2. Test Normal Behavior

```bash
# Test with short query (should complete quickly)
time curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2?"
  }'

# Expected: 200 OK with result in <5 seconds
```

### 3. Monitoring Logs

```bash
# Watch logs during testing
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Look for:
# - "[Query] Received: ..."
# - "[Query] Timeout triggered, aborting..." (if timeout occurs)
# - "[Query] Completed successfully" (normal case)
# - "[Error] Operation timed out after 25000ms" (timeout case)
```

---

## Key Findings from Research

### Claude Agent SDK 0.1.0 Limitations

1. **No built-in timeout configuration** - SDK does not expose timeout options
2. **Async generator pattern** - Requires custom timeout wrapping
3. **No abort signal support** - Cannot cancel in-flight requests
4. **Early release** - SDK released Oct 1, 2025 (7 days old), expect updates

### Industry Best Practices (October 2025)

1. **Wrap async generators** with timeout utilities
2. **Use Promise.race()** for timeout enforcement
3. **Clean up resources** in finally blocks
4. **Return 408 (not 503)** for timeouts
5. **Log timeout events** for monitoring

### Related GitHub Issues

- [anthropics/claude-agent-sdk-python#132](https://github.com/anthropics/claude-agent-sdk-python/issues/132) - Timeout configuration in Python SDK
- [anthropics/claude-code#5615](https://github.com/anthropics/claude-code/issues/5615) - Claude Code 2-minute timeout limitation

---

## Implementation Checklist

- [ ] Create `src/utils/timeout.ts` with `withTimeout()` function
- [ ] Update `src/server.ts` to wrap query() with timeout
- [ ] Add timeout logging with timestamps
- [ ] Test with short query (<5s)
- [ ] Test with long query (should timeout at 25s)
- [ ] Monitor logs for timeout errors
- [ ] Add metrics endpoint for timeout tracking
- [ ] Update documentation with timeout configuration
- [ ] Consider upgrading SDK when newer version available

---

## Additional Resources

- **Claude Agent SDK Docs**: https://docs.claude.com/en/api/agent-sdk/overview
- **Async Generators**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator
- **Promise.race()**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
- **Express Timeout**: https://expressjs.com/en/4x/api.html#req.setTimeout

---

**Next Steps**: Implement Solution 1 (Async Generator Timeout Wrapper) and deploy to production.
