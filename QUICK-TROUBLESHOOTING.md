# Research Agent MVP - Quick Troubleshooting Reference

## App Info

- **App ID**: `e13e1c19-b542-422d-8c21-40c45b3bb982`
- **URL**: https://research-agent-mvp-w8c42.ondigitalocean.app
- **Logs**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
- **Instance**: basic-xs (1 GB RAM, 1 vCPU)
- **Region**: Frankfurt (fra)

---

## Immediate Actions (When Query Endpoint Crashes)

### 1. Access Logs (Web Console)

1. Go to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
2. Set time range to "Last 1 hour"
3. Search for these keywords (in order):
   - `503` - Look for connection termination errors
   - `error` - Any error messages
   - `UnhandledPromiseRejection` - Unhandled exceptions
   - `TypeError` - SDK or code errors
   - `ANTHROPIC_API_KEY` - Authentication issues
   - `MCP` - MCP connection failures
   - `OOM` or `memory` - Out of memory
   - `timeout` - Request timeouts

### 2. Quick Test (Terminal)

```bash
# Test 1: Health (should work)
curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health

# Test 2: Simple query (will likely fail with 503)
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Test","max_tokens":100}' \
  -v
```

### 3. Watch Logs Live

```bash
# Terminal 1: Watch logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Terminal 2: Send query (see crash in real-time)
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Test","max_tokens":100}'
```

---

## Most Likely Root Causes (Ranked)

### 1. Unhandled Exception (80% likely)

**Symptoms**:
- Health works, query fails
- 503 connection_termination
- No specific error in logs (process just crashes)

**Fix**:
```typescript
// Add to src/server.ts
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Wrap query handler
app.post('/api/query', async (req, res) => {
  try {
    const result = await agent.run(req.body.query);
    res.json(result);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### 2. MCP Connection Failure (15% likely)

**Symptoms**:
- Logs show: `Error: connect ECONNREFUSED` or `ENOTFOUND`
- Gateway health check fails

**Fix**:
1. Test gateway: `curl https://mcp-infrastructure-rhvlk.ondigitalocean.app/health`
2. If gateway down: Fix gateway first
3. If gateway up: Check MCP_SHARED_SECRET env var

---

### 3. Missing API Key (3% likely)

**Symptoms**:
- Logs show: `ANTHROPIC_API_KEY is not defined` or `401`

**Fix**:
1. Check DO console: Apps → research-agent-mvp → Settings → Environment Variables
2. Verify ANTHROPIC_API_KEY is present and encrypted
3. If missing: Add it and redeploy

---

### 4. Out of Memory (1% likely)

**Symptoms**:
- Logs show: `JavaScript heap out of memory` or `exit code 137`
- Memory spikes to 100% in metrics

**Fix**:
Upgrade instance size to basic-s (2 GB RAM) via app spec update

---

### 5. Timeout (1% likely)

**Symptoms**:
- Query hangs for 60+ seconds
- Logs show: `timeout` or `ETIMEDOUT`

**Fix**:
Add timeout to MCP calls (45s max)

---

## Error Log Patterns

Search for these exact strings in DO logs:

| Search Term | Meaning | Action |
|-------------|---------|--------|
| `UnhandledPromiseRejectionWarning` | Unhandled promise rejection | Add error handlers |
| `TypeError: Cannot read property` | SDK error | Check agent.ts init code |
| `ANTHROPIC_API_KEY is not defined` | Missing API key | Check env vars |
| `Error: connect ECONNREFUSED` | MCP connection failed | Check gateway health |
| `JavaScript heap out of memory` | OOM | Upgrade to basic-s (2 GB) |
| `Load balancer timeout` | Request >60s | Add timeouts, use streaming |
| `Process exited with code 1` | Crash during request | Add try/catch |
| `Container terminated with exit code 137` | OOM kill | Upgrade RAM |

---

## CLI Commands

```bash
# Get app info
doctl apps get e13e1c19-b542-422d-8c21-40c45b3bb982

# Watch runtime logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Get last 1000 lines of logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000

# Save logs to file
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000 > logs.txt

# Check build logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type BUILD
```

---

## Decision Tree

```
Query returns 503
│
├─ Check DO logs for errors
│  │
│  ├─ Found "UnhandledPromiseRejection" → Add error handlers
│  ├─ Found "ANTHROPIC_API_KEY" → Check env vars
│  ├─ Found "ECONNREFUSED" → Check gateway health
│  ├─ Found "out of memory" → Upgrade to basic-s
│  └─ No errors found → Add process error handlers
│
├─ Test gateway health
│  │
│  ├─ Gateway down (not 200) → Fix gateway first
│  └─ Gateway up → Issue in research agent
│
└─ Run diagnostic script
   │
   └─ ./test-research-agent.sh
```

---

## Quick Fixes to Try (In Order)

### Fix 1: Add Error Handlers (Most Likely)

```bash
# Edit src/server.ts and add error handlers (see above)
git add .
git commit -m "fix: add error handlers for unhandled exceptions"
git push origin main
# Wait for auto-deploy (~2 minutes)
```

### Fix 2: Add Diagnostics Endpoint

```typescript
// Add to src/server.ts
app.get('/api/diagnostics', async (req, res) => {
  res.json({
    anthropic_api_key_present: !!process.env.ANTHROPIC_API_KEY,
    anthropic_api_key_prefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10),
    mcp_gateway_url: process.env.PERPLEXITY_MCP_URL,
    memory_usage: process.memoryUsage(),
    node_version: process.version,
  });
});
```

Test with: `curl https://research-agent-mvp-w8c42.ondigitalocean.app/api/diagnostics`

### Fix 3: Enable Debug Logging

Add to DO environment variables:
- `DEBUG`: `*`
- `NODE_OPTIONS`: `--trace-warnings`

Redeploy and check logs for detailed output.

---

## Test When Fixed

```bash
# Run full diagnostic suite
./test-research-agent.sh

# Or manual tests
curl https://research-agent-mvp-w8c42.ondigitalocean.app/health
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is 2+2?","max_tokens":100}'
```

---

## Success Criteria

Fixed when ALL these pass:

- Health endpoint returns 200
- Simple query returns 200 (not 503)
- No errors in logs during query
- Memory stays <70%
- Response time <30s

---

**For complete guide, see**: TROUBLESHOOTING-PLAYBOOK.md
