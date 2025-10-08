# Research Agent MVP - Complete Troubleshooting Playbook

**Last Updated**: 2025-10-08  
**App ID**: e13e1c19-b542-422d-8c21-40c45b3bb982  
**App URL**: https://research-agent-mvp-w8c42.ondigitalocean.app  
**Current Status**: ACTIVE and HEALTHY (health endpoint working)  
**Problem**: Query endpoint crashes with 503 connection_termination  

---

## Table of Contents

1. [Quick Status Check](#quick-status-check)
2. [Accessing DigitalOcean Logs](#accessing-digitalocean-logs)
3. [Error Pattern Recognition](#error-pattern-recognition)
4. [Diagnostic Testing Suite](#diagnostic-testing-suite)
5. [Root Cause Analysis](#root-cause-analysis)
6. [Alternative Diagnostic Approaches](#alternative-diagnostic-approaches)
7. [Recommended Next Steps](#recommended-next-steps)

---

## Quick Status Check

### Current Configuration (Validated)

**Resources**:
- Instance Size: `basic-xs` (1 vCPU, 1 GB RAM)
- Instance Count: 1
- Current Memory Usage: 7.23% (72 MB / 1024 MB)
- Current CPU Usage: 3.24%

**Health Check Settings** (Relaxed):
- Initial Delay: 30 seconds
- Period: 60 seconds (check every minute)
- Timeout: 10 seconds
- Failure Threshold: 3 consecutive failures
- Health Path: `/health`

**Environment Variables** (All Present):
- `ANTHROPIC_API_KEY`: Encrypted secret ✓
- `CONTEXT7_API_KEY`: Encrypted secret ✓
- `MCP_SHARED_SECRET`: Encrypted secret ✓
- `PERPLEXITY_MCP_URL`: https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp
- `BRIGHTDATA_MCP_URL`: https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp
- `PORT`: 8080
- `NODE_ENV`: production

**Latest Deployment**:
- Commit: `4d78c2884dc288329a6d03bd668644f9919498be`
- Deployed: 2025-10-08 20:23:02Z
- Build: Reused previous build (instant)
- Deploy Time: ~1 minute 15 seconds
- Phase: ACTIVE

---

## Accessing DigitalOcean Logs

### Method 1: Web Console (Recommended for Initial Investigation)

**Direct URL**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs

**Step-by-Step Navigation**:

1. **Login to DigitalOcean**
   - Go to https://cloud.digitalocean.com
   - Login with charlie@seismicmvmt.com

2. **Navigate to App Platform**
   - Click "Apps" in left sidebar
   - OR click this direct link: https://cloud.digitalocean.com/apps

3. **Open Research Agent App**
   - Click "research-agent-mvp" in app list
   - OR use direct app URL: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982

4. **Access Runtime Logs**
   - Click "Runtime Logs" tab (should be visible in top navigation)
   - Alternative: Click "Logs" in left submenu

5. **Filter and Search**
   - **Time Range**: Use date picker (top right) - set to "Last 1 hour" for recent errors
   - **Component Filter**: Select "research-agent" (if multiple components)
   - **Log Level**: Filter by ERROR, WARN, INFO
   - **Search Box**: Type keywords (see patterns below)

### Log Download Options

**Download Logs**:
- Click "Download" button (top right of logs panel)
- Exports last 10,000 lines as `.txt` file
- Useful for offline analysis or sharing

**Live Tail** (Real-time):
- Logs auto-update every few seconds
- Great for testing queries and watching crashes live

---

### Method 2: CLI Access (Advanced Users)

**Using doctl** (DigitalOcean CLI):

```bash
# Install doctl (if not already installed)
brew install doctl  # macOS

# Authenticate
doctl auth init

# Get recent logs (last 100 lines)
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 100

# Follow logs in real-time (like tail -f)
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Get deployment/build logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type BUILD
```

**Save Logs to File**:
```bash
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000 > runtime-logs.txt
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type BUILD > build-logs.txt
```

---

## Error Pattern Recognition

### Critical Error Patterns (What to Search For)

Use these search terms in the DigitalOcean logs search box:

#### 1. ANTHROPIC_API_KEY Issues

**Search Terms**: `ANTHROPIC_API_KEY`, `anthropic`, `401`, `invalid_api_key`, `authentication`

**Error Patterns**:
```
❌ "ANTHROPIC_API_KEY is not defined"
❌ "Invalid API key"
❌ "401 Unauthorized"
❌ "Authentication failed"
❌ "Missing required header: x-api-key"
```

**Diagnostic**:
- If you see these: API key is not reaching the application or is invalid
- **Action**: Verify secret is correctly set in DO console

---

#### 2. Claude Agent SDK Crashes

**Search Terms**: `@modelcontextprotocol/sdk`, `TypeError`, `Cannot read property`, `UnhandledPromiseRejection`, `FATAL`

**Error Patterns**:
```
❌ "TypeError: Cannot read property 'tools' of undefined"
❌ "UnhandledPromiseRejectionWarning: Error: SDK initialization failed"
❌ "Error: Failed to connect to MCP server"
❌ "Client initialization failed"
❌ "FATAL ERROR: Agent crashed during query execution"
```

**Diagnostic**:
- SDK version mismatch or improper initialization
- Agent crashes during query processing (not startup)

---

#### 3. MCP Connection Failures

**Search Terms**: `MCP`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `gateway`, `mcp-infrastructure`

**Error Patterns**:
```
❌ "Error: connect ECONNREFUSED"
❌ "Error: getaddrinfo ENOTFOUND"
❌ "MCP Gateway connection timeout"
❌ "Failed to initialize MCP transport"
❌ "HTTP transport error: 502 Bad Gateway"
❌ "MCP_SHARED_SECRET authentication failed"
```

**Diagnostic**:
- Cannot reach MCP gateway
- Gateway is down or rejecting requests

---

#### 4. Out of Memory (OOM)

**Search Terms**: `OOM`, `out of memory`, `killed`, `SIGKILL`, `heap`, `memory limit`

**Error Patterns**:
```
❌ "FATAL ERROR: Ineffective mark-compacts near heap limit"
❌ "JavaScript heap out of memory"
❌ "Process killed (OOM)"
❌ "Container terminated with exit code 137"
```

**Diagnostic**:
- Application exceeds 1 GB RAM limit
- Memory leak during query processing

---

#### 5. Request Timeouts

**Search Terms**: `timeout`, `ETIMEDOUT`, `ESOCKETTIMEDOUT`, `deadline exceeded`, `aborted`

**Error Patterns**:
```
❌ "Error: Request timeout after 30000ms"
❌ "Claude API request exceeded timeout"
❌ "ESOCKETTIMEDOUT: Socket timeout"
❌ "Connection aborted: deadline exceeded"
❌ "Load balancer timeout (60s)"
```

**Diagnostic**:
- Query takes >60 seconds (DO load balancer timeout)
- Claude API slow to respond

---

#### 6. HTTP 503 Connection Termination (Your Current Issue)

**Search Terms**: `503`, `connection_termination`, `Service Unavailable`, `container crash`, `restart`

**Error Patterns**:
```
❌ "503 Service Unavailable: connection_termination"
❌ "Container restarted unexpectedly during request"
❌ "Process exited with code 1 during query"
❌ "Uncaught exception: [stack trace]"
```

**Diagnostic**:
- Application crashes DURING query processing (not at startup)
- Health check passes, but query endpoint fails
- **Root Cause**: Likely unhandled exception in query handler

---

## Diagnostic Testing Suite

### Test Script (`test-research-agent.sh`)

```bash
#!/bin/bash

# Research Agent MVP - Diagnostic Test Suite
APP_URL="https://research-agent-mvp-w8c42.ondigitalocean.app"
GATEWAY_URL="https://mcp-infrastructure-rhvlk.ondigitalocean.app"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="diagnostic-${TIMESTAMP}.log"

echo "=== Research Agent MVP Diagnostic Test Suite ===" | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 1: Health Check
echo "Test 1: Health Check" | tee -a "$LOG_FILE"
curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\n" "$APP_URL/health" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 2: MCP Gateway Health
echo "Test 2: MCP Gateway Health" | tee -a "$LOG_FILE"
curl -s -w "\nHTTP_CODE:%{http_code}\n" "$GATEWAY_URL/health" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 3: Simple Query
echo "Test 3: Simple Query (Minimal Load)" | tee -a "$LOG_FILE"
curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\n" \
    -X POST "$APP_URL/api/query" \
    -H "Content-Type: application/json" \
    -d '{"query":"What is 2+2?","max_tokens":100}' \
    --max-time 120 | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 4: Research Query (With MCP)
echo "Test 4: Research Query (With MCP Tools)" | tee -a "$LOG_FILE"
curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\n" \
    -X POST "$APP_URL/api/query" \
    -H "Content-Type: application/json" \
    -d '{"query":"Search for TypeScript 5.8 features","max_tokens":500}' \
    --max-time 120 | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "=== Test Complete ===" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
```

**Run with**:
```bash
chmod +x test-research-agent.sh
./test-research-agent.sh
```

---

### Manual Testing Commands

**Quick Health Check**:
```bash
curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health
```

**Simple Query Test**:
```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is 2+2?","max_tokens":100}' \
  -v
```

**Watch Logs in Real-Time** (while testing):
```bash
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow
```

---

## Root Cause Analysis

### Hypothesis 1: Unhandled Exception in Query Handler (MOST LIKELY)

**Symptoms Match**:
- Health endpoint works (app starts successfully)
- App is ACTIVE and HEALTHY (7% memory, 3% CPU)
- 503 connection_termination (process crashes during request)

**Root Cause**:
Query handler has unhandled exception that crashes Node.js:
- Try/catch missing around agent initialization
- Unhandled promise rejection during MCP calls
- SDK method called incorrectly

**Evidence to Look For**:
```
UnhandledPromiseRejectionWarning
TypeError: Cannot read property
Error: [anything] at agent.ts:XX
Process exited with code 1
```

**Action Items**:
1. Add comprehensive error handling to query endpoint
2. Wrap agent execution in try/catch
3. Add process-level handlers:
   ```typescript
   process.on('unhandledRejection', (reason, promise) => {
     console.error('Unhandled Rejection:', reason);
   });
   ```

---

### Hypothesis 2: MCP SDK Initialization Timing Issue

**Symptoms**:
- Health check succeeds (no MCP calls)
- Query fails (requires MCP initialization)

**Root Cause**:
MCP clients initialized on first query (lazy), not at startup

**Action Items**:
1. Move MCP initialization to startup
2. Add retry logic for MCP connections
3. Fail gracefully if MCP unavailable

---

### Hypothesis 3: Claude API Request Exceeds Timeout

**Symptoms**:
- Request hangs for 60+ seconds
- Load balancer kills connection (503)

**Root Cause**:
Claude API request with MCP tools takes >60s (DO load balancer timeout)

**Action Items**:
1. Add timeout to Claude API calls (45s max)
2. Implement streaming responses
3. Add request cancellation

---

### Hypothesis 4: Memory Spike During Query

**Symptoms**:
- Base memory: 72 MB
- Query triggers spike >1 GB
- OOM killer terminates process

**Root Cause**:
MCP responses too large (BrightData scraping, Context7 docs)

**Action Items**:
1. Monitor memory during query
2. Add response size limits
3. Stream responses
4. Upgrade to basic-s (2 GB RAM)

---

### Hypothesis 5: ANTHROPIC_API_KEY Not Available

**Symptoms**:
- Health check passes (doesn't use API key)
- Query fails immediately (needs API key)

**Root Cause**:
Environment variable not accessible at runtime

**Action Items**:
1. Add startup validation
2. Log API key presence (first 10 chars only)
3. Add healthcheck for env vars

---

## Alternative Diagnostic Approaches

### 1. Enable Debug Logging

Add to environment variables in DO console:
- `DEBUG`: `*`
- `NODE_OPTIONS`: `--trace-warnings`

Redeploy and check logs for verbose output.

---

### 2. Add Diagnostics Endpoint

Create `/api/diagnostics` endpoint:

```typescript
app.get('/api/diagnostics', async (req, res) => {
  const diagnostics = {
    anthropic_api_key_present: !!process.env.ANTHROPIC_API_KEY,
    anthropic_api_key_prefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10),
    mcp_gateway_url: process.env.PERPLEXITY_MCP_URL,
    memory_usage: process.memoryUsage(),
    node_version: process.version,
  };

  // Test MCP Gateway
  try {
    const response = await fetch(process.env.PERPLEXITY_MCP_URL + '/health');
    diagnostics.mcp_gateway_status = response.status;
  } catch (error) {
    diagnostics.mcp_gateway_error = error.message;
  }

  res.json(diagnostics);
});
```

---

### 3. Check Build Logs

```bash
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type BUILD > build-logs.txt
```

Look for warnings, deprecated packages, peer dependency issues.

---

### 4. Monitor Real-Time Metrics

1. Go to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
2. Click "Insights" or "Metrics" tab
3. Watch during query test:
   - CPU spikes
   - Memory spikes
   - Request count
   - Error rate

---

### 5. Test with Minimal Configuration

Test with ONLY Context7 (no Perplexity/BrightData):
- If works: Gateway connection issue
- If fails: Core agent code issue

---

## Recommended Next Steps

### Immediate Actions (15 Minutes)

1. **Access DigitalOcean Logs**:
   - Go to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
   - Search for: `503`, `error`, `crash`, `exception`

2. **Run Diagnostic Script**:
   ```bash
   ./test-research-agent.sh
   ```

3. **Watch Logs While Testing**:
   ```bash
   # Terminal 1: Watch logs
   doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

   # Terminal 2: Send test query
   curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
     -H "Content-Type: application/json" \
     -d '{"query":"Test","max_tokens":100}'
   ```

---

### Short-Term Fixes (1-2 Hours)

**If unhandled exception**:
```typescript
// Add process-level handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
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

**If MCP timeout**:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 45000);

const response = await fetch(url, {
  signal: controller.signal,
  headers: {...}
});

clearTimeout(timeout);
```

---

## Decision Tree

```
Query endpoint returns 503
│
├─ Check logs: Error messages?
│  ├─ YES: Match to patterns → Apply fix
│  └─ NO: Add error handlers → Redeploy
│
├─ Check metrics: Memory spike >80%?
│  ├─ YES: Upgrade to basic-s (2 GB)
│  └─ NO: Not memory issue
│
├─ Check gateway: MCP healthy?
│  ├─ NO: Fix gateway first
│  └─ YES: Issue in research agent
│
├─ Test simple query: Works?
│  ├─ YES: Issue with MCP tools
│  └─ NO: Check API key, SDK init
│
└─ Still stuck: Add diagnostics endpoint
```

---

## Quick Reference

**App Details**:
- App ID: `e13e1c19-b542-422d-8c21-40c45b3bb982`
- URL: https://research-agent-mvp-w8c42.ondigitalocean.app
- Logs: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
- Region: Frankfurt (fra)
- Instance: basic-xs (1 GB RAM, 1 vCPU)

**CLI Commands**:
```bash
# Watch logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Test health
curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health

# Test query
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Test","max_tokens":100}'
```

---

## Success Criteria

✅ Health endpoint returns 200  
✅ Simple query returns 200 with valid response  
✅ Research query (with MCP) returns 200  
✅ No 503 errors in logs  
✅ Memory stays <70% during queries  
✅ Response time <30 seconds  

---

**Last Updated**: 2025-10-08  
**Version**: 1.0  
**Author**: DigitalOcean Specialist  
