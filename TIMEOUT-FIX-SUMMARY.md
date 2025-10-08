# Claude Agent SDK Timeout Fix - Implementation Summary

**Date**: 2025-10-08  
**Issue**: Query endpoint hangs indefinitely, causing 503 Gateway Timeout  
**Solution**: Custom async generator timeout wrapper  
**Status**: Ready to implement

---

## Problem Statement

The research agent MVP deployment experiences 503 Gateway Timeout errors when the `/query` endpoint is called. The health endpoint works fine, but queries never complete.

**Root Cause**: Claude Agent SDK 0.1.0 does not provide built-in timeout configuration. The `query()` function returns an async generator that can hang indefinitely if:
- MCP gateway connection hangs
- MCP server (Context7, Perplexity, BrightData) times out
- Network issues occur mid-request
- Claude API takes too long to respond

---

## Solution Overview

Implement a custom timeout wrapper around the async generator returned by `query()`:

```typescript
// Wrap the query iterator with timeout protection
const queryIterator = query({ prompt, options });
const timeoutIterator = withTimeout(queryIterator, 25000); // 25 second timeout

for await (const message of timeoutIterator) {
  // Process messages...
}
```

---

## Files Created

### 1. CLAUDE-AGENT-SDK-TIMEOUT-RESEARCH.md
**Location**: `/remote-agents/research-agent-mvp/CLAUDE-AGENT-SDK-TIMEOUT-RESEARCH.md`  
**Purpose**: Comprehensive research findings on timeout handling  
**Contents**:
- Root cause analysis
- Solution patterns (3 approaches)
- Implementation examples
- Testing strategy
- Best practices
- Industry research citations

### 2. src/utils/timeout.ts
**Location**: `/remote-agents/research-agent-mvp/src/utils/timeout.ts`  
**Purpose**: Reusable timeout utility for async generators  
**Exports**:
- `withTimeout<T>()` - Basic timeout wrapper
- Handles cleanup in finally block
- Supports optional timeout callback

### 3. src/server-with-timeout.ts
**Location**: `/remote-agents/research-agent-mvp/src/server-with-timeout.ts`  
**Purpose**: Reference implementation showing timeout integration  
**Changes**:
- Imports `withTimeout` utility
- Wraps `query()` with 25-second timeout
- Returns 408 (Request Timeout) instead of 503
- Logs elapsed time for all requests
- Distinguishes timeout errors from other errors

---

## Implementation Steps

### Step 1: Copy timeout utility to src directory

The `src/utils/timeout.ts` file is already created and ready to use.

### Step 2: Update src/server.ts

**Option A**: Replace `src/server.ts` with `src/server-with-timeout.ts`:
```bash
cd /Users/charliefisher/Desktop/seismic-core(Tue, Sept30)/claude(staging)/remote-agents/research-agent-mvp
cp src/server-with-timeout.ts src/server.ts
```

**Option B**: Manually integrate changes:
1. Add import: `import { withTimeout } from './utils/timeout';`
2. Add timeout constant: `const TIMEOUTS = { QUERY_TOTAL: 25000 };`
3. Wrap query iterator with `withTimeout(queryIterator, TIMEOUTS.QUERY_TOTAL)`
4. Update error handling to return 408 for timeouts

### Step 3: Rebuild and test locally

```bash
# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Test locally
npm run dev

# In another terminal, test query endpoint
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is 2+2?"}'
```

### Step 4: Commit and deploy to DigitalOcean

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "fix: add timeout protection to query endpoint

- Add withTimeout() utility for async generators
- Wrap query() with 25-second timeout to prevent indefinite hangs
- Return 408 Request Timeout instead of 503 Gateway Timeout
- Add elapsed time logging for monitoring
- Comprehensive research documentation included

Fixes: Query endpoint 503 errors
See: CLAUDE-AGENT-SDK-TIMEOUT-RESEARCH.md"

# Push to trigger auto-deployment
git push origin main
```

### Step 5: Monitor deployment

```bash
# Watch DigitalOcean logs during deployment
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Or use web console
# https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
```

### Step 6: Test production deployment

```bash
# Run diagnostic script
./test-research-agent.sh

# Expected results:
# - Health check: 200 OK
# - Simple query: 200 OK (fast response)
# - Research query: 200 OK or 408 Timeout (if >25s)
# - No more 503 errors
```

---

## Testing Scenarios

### Scenario 1: Fast Query (Should Complete)

```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is 2+2?"}'

# Expected: 200 OK with result in <5 seconds
```

### Scenario 2: Moderate Query (Should Complete)

```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use Context7 to get Next.js 14 routing documentation"}'

# Expected: 200 OK with result in 10-20 seconds
```

### Scenario 3: Long Query (Should Timeout Gracefully)

```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use Perplexity perplexity_research to do comprehensive research on quantum computing advances in 2025 with full citations and code examples from multiple sources"}'

# Expected: 408 Request Timeout after ~25 seconds (if query takes >25s)
# Response: {"success":false,"error":"Operation timed out after 25000ms","type":"timeout"}
```

---

## Success Criteria

- ✅ Health endpoint returns 200 OK
- ✅ Simple queries return 200 OK with results
- ✅ Long queries return 408 Timeout (not 503 Gateway Timeout)
- ✅ Timeout errors logged clearly with elapsed time
- ✅ No process crashes during queries
- ✅ Memory stays <70% during queries
- ✅ All errors have appropriate HTTP status codes

---

## Monitoring and Observability

### Key Metrics to Track

1. **Query completion rate**: Successful queries / Total queries
2. **Timeout rate**: Timeouts / Total queries
3. **Average response time**: Mean elapsed time for successful queries
4. **95th percentile response time**: P95 elapsed time

### Log Patterns to Watch

**Success Pattern**:
```
[Query] Received: ...
[Agent] Final result captured
[Query] Completed successfully in 5234ms
```

**Timeout Pattern**:
```
[Query] Received: ...
[Query] Timeout triggered after 25000ms, aborting...
[Error] Query failed after 25012ms: Error: Operation timed out after 25000ms
```

**Error Pattern**:
```
[Query] Received: ...
[Error] Query failed after 3421ms: Error: ...
```

### Alerting Recommendations

1. **High timeout rate** (>20%): Increase timeout threshold or optimize queries
2. **All queries timing out**: MCP gateway down or Claude API issues
3. **Memory spikes**: Consider upgrading instance size

---

## Rollback Plan

If timeout implementation causes issues:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or restore original server.ts from backup
cp src/server.ts.backup src/server.ts
git add src/server.ts
git commit -m "rollback: revert timeout changes"
git push origin main
```

---

## Future Improvements

### Phase 1: Enhanced Observability (This Week)
- [ ] Add `/metrics` endpoint with timeout statistics
- [ ] Add structured logging (JSON logs)
- [ ] Add request tracing with correlation IDs

### Phase 2: Advanced Timeout Handling (Next Sprint)
- [ ] Implement dual timeout (per-iteration + total)
- [ ] Add retry logic for transient failures
- [ ] Implement circuit breaker for MCP gateway
- [ ] Add graceful degradation (return partial results)

### Phase 3: Performance Optimization (Future)
- [ ] Implement response streaming for long queries
- [ ] Add caching layer for common queries
- [ ] Optimize MCP server selection based on query type
- [ ] Implement query queue for load management

---

## Related Documentation

- **Research Report**: `CLAUDE-AGENT-SDK-TIMEOUT-RESEARCH.md`
- **Troubleshooting**: `TROUBLESHOOTING-PLAYBOOK.md`
- **Quick Reference**: `QUICK-TROUBLESHOOTING.md`
- **Architecture**: `ARCHITECTURE.md`

---

## Contact & Support

**App**: research-agent-mvp  
**Owner**: charlie@seismicmvmt.com  
**Deployment**: DigitalOcean App Platform (Frankfurt)  
**App URL**: https://research-agent-mvp-w8c42.ondigitalocean.app

---

**Status**: ✅ Ready to implement  
**Confidence**: High (solution validated against SDK patterns and Express best practices)  
**Risk**: Low (graceful degradation, no breaking changes)  
**Estimated Implementation Time**: 30 minutes (including testing)
