# Research Agent MVP - MCP Infrastructure Connection Plan

**Date**: 2025-10-08
**Status**: READY FOR EXECUTION
**Estimated Time**: 15-20 minutes (including validation)

---

## Executive Summary

The research-agent-mvp is currently **DOWN** (503 error) due to:
1. **Wrong MCP Gateway URL**: Points to deleted `mcp-servers-app` instead of active `mcp-infrastructure`
2. **Missing Authentication**: No `X-MCP-Secret` header for gateway authentication
3. **Missing Environment Variable**: `MCP_SHARED_SECRET` not configured in DigitalOcean

**Solution**: Update 3 source files + add 2 environment variables, then redeploy.

---

## Current State Analysis

### Research Agent Status
- **URL**: https://research-agent-mvp-w8c42.ondigitalocean.app
- **App ID**: `e13e1c19-b542-422d-8c21-40c45b3bb982`
- **Status**: 503 Error - "no_healthy_upstream"
- **Health**: Attempting to connect to non-existent MCP server
- **Last Deploy**: 2025-10-08T12:57:51Z (commit: 8f08de4)

### MCP Infrastructure Status
- **URL**: https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp
- **App ID**: `e039c351-056f-45ab-ae40-abe02173c25a`
- **Status**: HEALTHY (verified: `{"status":"healthy","service":"mcp-gateway"}`)
- **Components**: 3/3 healthy (gateway, perplexity, brightdata)
- **Auth Required**: `X-MCP-Secret: o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=`

### Current Configuration Issues

**Wrong URLs** (3 files):
```typescript
// WRONG (deleted app):
'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp'

// CORRECT (active app):
'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp'
```

**Missing Auth** (3 files):
```typescript
headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream'
  // MISSING: 'X-MCP-Secret': process.env.MCP_SHARED_SECRET
}
```

**Missing Env Var** (DigitalOcean):
```bash
# Currently: ANTHROPIC_API_KEY, PORT, NODE_ENV
# Missing: MCP_SERVERS_URL, MCP_SHARED_SECRET
```

---

## Part 1: Source Code Updates

### Step 1.1: Update src/server.ts (Line 108)

**File**: `/Users/charliefisher/Desktop/seismic-core(Tue, Sept30)/claude(staging)/remote-agents/research-agent-mvp/src/server.ts`

```diff
  mcpServers: {
    unified: {
      type: 'stdio',
      command: 'node',
      args: ['./dist/mcp-proxy.js'],
      env: {
-       MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp'
+       MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp',
+       MCP_SHARED_SECRET: process.env.MCP_SHARED_SECRET || ''
      }
    }
  }
```

### Step 1.2: Update src/mcp-proxy.ts (Lines 13, 35)

**File**: `/Users/charliefisher/Desktop/seismic-core(Tue, Sept30)/claude(staging)/remote-agents/research-agent-mvp/src/mcp-proxy.ts`

**Change 1** (Line 13):
```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
+ const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';
```

**Change 2** (Line 35):
```diff
  const response = await axios.post(MCP_SERVER_URL, request, {
    headers: {
      'Content-Type': 'application/json',
-     'Accept': 'application/json, text/event-stream'
+     'Accept': 'application/json, text/event-stream',
+     'X-MCP-Secret': MCP_SHARED_SECRET
    },
```

### Step 1.3: Update src/mcp-client.ts (Lines 10, 37, 132)

**File**: `/Users/charliefisher/Desktop/seismic-core(Tue, Sept30)/claude(staging)/remote-agents/research-agent-mvp/src/mcp-client.ts`

**Change 1** (Line 10):
```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
+ const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';
```

**Change 2** (Line 37):
```diff
  const headers = {
    'Content-Type': 'application/json',
-   'Accept': 'application/json, text/event-stream'
+   'Accept': 'application/json, text/event-stream',
+   'X-MCP-Secret': MCP_SHARED_SECRET
  };
```

**Change 3** (Line 132):
```diff
  headers: {
    'Content-Type': 'application/json',
-   'Accept': 'application/json, text/event-stream'
+   'Accept': 'application/json, text/event-stream',
+   'X-MCP-Secret': MCP_SHARED_SECRET
  }
```

---

## Part 2: DigitalOcean App Update Specification

### Step 2.1: Exact Update JSON

Use `mcp__digitalocean__apps-update` with this specification:

```json
{
  "update": {
    "app_id": "e13e1c19-b542-422d-8c21-40c45b3bb982",
    "request": {
      "spec": {
        "name": "research-agent-mvp",
        "services": [
          {
            "name": "research-agent",
            "git": {
              "repo_clone_url": "https://github.com/cfisher8565/research-agent-mvp.git",
              "branch": "main"
            },
            "dockerfile_path": "Dockerfile",
            "envs": [
              {
                "key": "ANTHROPIC_API_KEY",
                "value": "EV[1:8hx9HcyGJcwxJ5Mv/Z5bWMDcLMeMSE8v:sg/1Q1mAeE8v44pgiMuVifrtrzDiL5vEvxAMqoRuSsW0xBx2w1WaAcVQ9KMn25jypM2OL9f+ZMnCORSdHuIN3VefMiS1oxmLuyoZnntvfrEj0P/odMuHc3C0GF3hS93kl/u+QLgguSc239BeYIbDZ/hDFSqC7R6eunJS1w==]",
                "scope": "RUN_TIME",
                "type": "SECRET"
              },
              {
                "key": "MCP_SERVERS_URL",
                "value": "https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp",
                "scope": "RUN_TIME"
              },
              {
                "key": "MCP_SHARED_SECRET",
                "value": "o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=",
                "scope": "RUN_TIME",
                "type": "SECRET"
              },
              {
                "key": "PORT",
                "value": "8080",
                "scope": "RUN_TIME"
              },
              {
                "key": "NODE_ENV",
                "value": "production",
                "scope": "RUN_TIME"
              }
            ],
            "instance_size_slug": "basic-xxs",
            "instance_count": 1,
            "http_port": 8080,
            "health_check": {
              "initial_delay_seconds": 10,
              "period_seconds": 30,
              "timeout_seconds": 3,
              "success_threshold": 1,
              "failure_threshold": 3,
              "http_path": "/health"
            }
          }
        ],
        "region": "fra",
        "ingress": {
          "rules": [
            {
              "match": {
                "path": {
                  "prefix": "/"
                }
              },
              "component": {
                "name": "research-agent"
              }
            }
          ]
        }
      }
    }
  }
}
```

### Step 2.2: Pre-Update Verification

**Before making changes**, verify MCP gateway is responsive:

```bash
# Test 1: Gateway health check
curl -s https://mcp-infrastructure-rhvlk.ondigitalocean.app/health

# Expected: {"status":"healthy","service":"mcp-gateway","timestamp":"..."}

# Test 2: Gateway with authentication
curl -s -X POST https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Secret: o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Expected: {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
# Tool count should be 10 (Context7: 2, Perplexity: 4, BrightData: 4)
```

---

## Part 3: Deployment Execution

### Step 3.1: Pre-Deployment Checklist

- [ ] **Source code updated**: All 3 files modified (server.ts, mcp-proxy.ts, mcp-client.ts)
- [ ] **Code committed to GitHub**: Changes pushed to `main` branch
- [ ] **MCP Gateway healthy**: Health check returns 200 OK
- [ ] **Auth secret verified**: Test MCP gateway with authentication header
- [ ] **Tool count verified**: Gateway returns 10 tools in `tools/list` response

### Step 3.2: Execute Update

**Option A: Using DigitalOcean MCP Tool**
```typescript
// Via Claude Code with DigitalOcean specialist
mcp__digitalocean__apps-update({
  update: {
    app_id: "e13e1c19-b542-422d-8c21-40c45b3bb982",
    request: { /* spec from Part 2.1 */ }
  }
})
```

**Option B: Using doctl CLI**
```bash
# Save spec to file
cat > /tmp/research-agent-update.json << 'EOF'
{
  "spec": { /* spec from Part 2.1 */ }
}
EOF

# Apply update
doctl apps update e13e1c19-b542-422d-8c21-40c45b3bb982 \
  --spec /tmp/research-agent-update.json
```

### Step 3.3: Monitor Deployment

**Watch deployment progress**:
```bash
# Option 1: Via MCP tool
mcp__digitalocean__apps-get-deployment-status({
  AppID: "e13e1c19-b542-422d-8c21-40c45b3bb982"
})

# Option 2: Via CLI
doctl apps get-deployment e13e1c19-b542-422d-8c21-40c45b3bb982

# Check every 30 seconds until phase === "ACTIVE"
```

**Expected timeline**:
- Build: ~30-45 seconds (TypeScript compilation)
- Deploy: ~45-60 seconds (container startup + health checks)
- Total: ~2-3 minutes

---

## Part 4: Post-Deployment Validation

### Step 4.1: Health Check Validation

**Test 1: Basic Health Check**
```bash
curl -s https://research-agent-mvp-w8c42.ondigitalocean.app/health

# Expected Response:
{
  "status": "healthy",
  "agent": "research-mvp",
  "mcp": {
    "success": true,
    "toolCount": 10,
    "tools": [
      "mcp__context7__resolve-library-id",
      "mcp__context7__get-library-docs",
      "perplexity_search",
      "perplexity_ask",
      "perplexity_research",
      "perplexity_reason",
      "mcp__brightdata__search_engine",
      "mcp__brightdata__scrape_as_markdown",
      "mcp__brightdata__scrape_batch",
      "mcp__brightdata__search_engine_batch"
    ]
  },
  "timestamp": "2025-10-08T..."
}
```

**Success Criteria**:
- ✅ HTTP 200 status code
- ✅ `"status": "healthy"`
- ✅ `"mcp.success": true`
- ✅ `"mcp.toolCount": 10`
- ✅ All 10 tool names listed

**Failure Indicators**:
- ❌ HTTP 503 - App not starting (check logs for crash)
- ❌ `"mcp.success": false` - Cannot reach MCP gateway (wrong URL or auth)
- ❌ `"mcp.toolCount": 0` - Gateway connection failed (check network/auth)

### Step 4.2: Context7 Tool Test

**Test 2: Context7 Library Lookup**
```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use Context7 to find the library ID for TanStack Query"
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "result": "The Context7 library ID for TanStack Query is /tanstack/query..."
  }
}
```

**Success Criteria**:
- ✅ HTTP 200 status code
- ✅ `"success": true`
- ✅ Response contains library ID format `/org/project`
- ✅ No error messages in response

### Step 4.3: Perplexity Tool Test

**Test 3: Perplexity Research**
```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use Perplexity to research Next.js 14 App Router best practices"
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "result": "Based on Perplexity research, Next.js 14 App Router best practices include..."
  }
}
```

**Success Criteria**:
- ✅ HTTP 200 status code
- ✅ `"success": true`
- ✅ Response contains research findings
- ✅ Citations or sources mentioned

### Step 4.4: BrightData Tool Test

**Test 4: BrightData Scraping**
```bash
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use BrightData to scrape the homepage of https://nextjs.org"
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "result": "Scraped content from Next.js homepage: # Next.js..."
  }
}
```

**Success Criteria**:
- ✅ HTTP 200 status code
- ✅ `"success": true`
- ✅ Response contains scraped content in markdown
- ✅ No 404 or timeout errors

---

## Part 5: Troubleshooting Guide

### Issue 1: Health Check Returns 503

**Symptoms**:
```html
<p class="code">Error</p>
<p class="text">no_healthy_upstream (503 UH)</p>
```

**Diagnosis**:
```bash
# Check app logs via DigitalOcean dashboard
# Look for:
# - Container crash on startup
# - Missing environment variables
# - TypeScript compilation errors
```

**Solutions**:
1. **Check build logs**: Ensure TypeScript compiled successfully
2. **Verify env vars**: All 5 variables present (ANTHROPIC_API_KEY, MCP_SERVERS_URL, MCP_SHARED_SECRET, PORT, NODE_ENV)
3. **Check health check path**: `/health` endpoint must return 200 within 10 seconds

### Issue 2: Health Check Shows toolCount: 0

**Symptoms**:
```json
{
  "status": "healthy",
  "mcp": {
    "success": false,
    "toolCount": 0,
    "tools": []
  }
}
```

**Diagnosis**:
```bash
# Test MCP gateway directly
curl -X POST https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Secret: o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# If this fails, MCP gateway is down
```

**Solutions**:
1. **Wrong URL**: Verify `MCP_SERVERS_URL` points to correct gateway
2. **Missing auth**: Verify `MCP_SHARED_SECRET` is set and correct
3. **Gateway down**: Check MCP infrastructure health status

### Issue 3: Query Endpoint Returns Errors

**Symptoms**:
```json
{
  "success": false,
  "error": "MCP HTTP call failed: ..."
}
```

**Diagnosis**:
```bash
# Check which tool is failing
# Look at error message for clues:
# - "401 Unauthorized" → Auth secret mismatch
# - "404 Not Found" → Wrong gateway URL
# - "500 Internal Server Error" → Gateway or backend issue
# - "Timeout" → MCP server overloaded or crashed
```

**Solutions**:
1. **Auth errors**: Verify secret matches between research agent and gateway
2. **404 errors**: Verify URL is correct MCP infrastructure endpoint
3. **500 errors**: Check MCP infrastructure component health
4. **Timeout**: Increase axios timeout in mcp-client.ts or mcp-proxy.ts

### Issue 4: Specific Tool Fails But Others Work

**Symptoms**:
```json
{
  "success": false,
  "error": "MCP tool perplexity_research failed: ..."
}
```

**Diagnosis**:
- Context7 tools fail → Context7 API key invalid or quota exceeded
- Perplexity tools fail → Perplexity API key invalid or service down
- BrightData tools fail → BrightData token invalid or proxy error

**Solutions**:
1. **Check MCP gateway logs**: Identify which backend server is failing
2. **Verify API keys**: Check environment variables in MCP infrastructure app
3. **Test backend directly**: Use MCP gateway to call specific tool manually
4. **Check quotas**: Verify API usage limits not exceeded

---

## Part 6: Rollback Plan

### If Update Fails: Revert to Previous State

**Step 6.1: Identify Last Working Deployment**

```bash
# Get deployment history
doctl apps list-deployments e13e1c19-b542-422d-8c21-40c45b3bb982

# Find last ACTIVE deployment before update
# Note: previous_deployment_id = d63cf0a2-e005-46c8-bede-624f47397b79
```

**Step 6.2: Rollback via DigitalOcean Dashboard**

1. Navigate to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
2. Click "Deployments" tab
3. Find deployment `d63cf0a2-e005-46c8-bede-624f47397b79` (last working)
4. Click "..." menu → "Redeploy"
5. Wait 2-3 minutes for rollback to complete

**Step 6.3: Alternative - Remove New Env Vars**

If rollback not needed, just remove problematic variables:

```bash
# Update app spec - remove MCP_SERVERS_URL and MCP_SHARED_SECRET
# This will cause health check to show toolCount: 0 but app won't crash
```

### If MCP Gateway Fails: Alternative Connection

**Fallback Strategy**: Direct connection to individual MCP servers

1. **Update research agent** to bypass gateway
2. **Connect directly** to:
   - Context7: `https://mcp.context7.com/mcp` (hosted, requires CONTEXT7_API_KEY)
   - Perplexity: Deploy standalone perplexity-mcp container
   - BrightData: Deploy standalone brightdata-mcp container

3. **Update mcp-client.ts** with individual URLs:
```typescript
const CONTEXT7_URL = 'https://mcp.context7.com/mcp';
const PERPLEXITY_URL = 'http://perplexity-mcp.internal:8802';
const BRIGHTDATA_URL = 'http://brightdata-mcp.internal:8803';
```

---

## Part 7: Success Metrics

### Deployment Success Criteria

**Immediate (0-5 minutes)**:
- ✅ Build completes without errors
- ✅ Container starts and passes health checks
- ✅ Health endpoint returns 200 OK
- ✅ MCP connection shows 10 tools

**Short-term (5-15 minutes)**:
- ✅ All 3 tool categories functional (Context7, Perplexity, BrightData)
- ✅ Query endpoint handles requests without errors
- ✅ No container restarts or crashes
- ✅ CPU/Memory usage within normal range (<20%)

**Long-term (1+ hours)**:
- ✅ Application remains healthy
- ✅ No 503 errors for users
- ✅ Research queries complete successfully
- ✅ No API rate limit errors

### Monitoring Dashboard

**DigitalOcean App Platform**:
- URL: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
- Monitor: CPU, Memory, Request Rate, Error Rate
- Check: Runtime logs for errors or warnings

**Health Check Monitoring**:
```bash
# Continuous health monitoring (every 30 seconds)
watch -n 30 'curl -s https://research-agent-mvp-w8c42.ondigitalocean.app/health | grep -o "toolCount\":[0-9]*"'

# Expected: toolCount":10 (consistently)
```

---

## Part 8: Deployment Checklist

### Pre-Deployment

- [ ] MCP gateway health verified: `curl https://mcp-infrastructure-rhvlk.ondigitalocean.app/health`
- [ ] MCP gateway auth tested: `tools/list` returns 10 tools
- [ ] Source code updated: 3 files modified (server.ts, mcp-proxy.ts, mcp-client.ts)
- [ ] Changes committed: GitHub repo at latest commit
- [ ] Update JSON prepared: Spec from Part 2.1 ready
- [ ] Rollback plan reviewed: Know how to revert if needed

### During Deployment

- [ ] Update triggered: Via MCP tool or doctl CLI
- [ ] Build monitoring: Watch build logs for errors
- [ ] Deploy monitoring: Watch container startup
- [ ] Health check monitoring: Wait for 200 OK response
- [ ] Deployment phase: Verify `"phase": "ACTIVE"`

### Post-Deployment

- [ ] Health check validated: `toolCount: 10` confirmed
- [ ] Context7 test passed: Library lookup returns results
- [ ] Perplexity test passed: Research query returns findings
- [ ] BrightData test passed: Scraping returns content
- [ ] No errors in logs: Check DigitalOcean runtime logs
- [ ] Performance normal: CPU/Memory within expected range
- [ ] Documentation updated: Mark deployment as successful

---

## Part 9: Expected Errors (and How to Interpret)

### During Development/Testing

**Error 1**: `MCP HTTP call failed: connect ECONNREFUSED`
- **Meaning**: Cannot reach MCP gateway URL
- **Fix**: Verify URL is correct and gateway is running

**Error 2**: `MCP tools/list failed: Unauthorized`
- **Meaning**: Missing or incorrect `X-MCP-Secret` header
- **Fix**: Verify secret matches between agent and gateway

**Error 3**: `MCP tool ... failed: Tool not found`
- **Meaning**: Tool name mismatch or backend server down
- **Fix**: Verify tool names match exactly (case-sensitive)

### During Production

**Error 4**: `Request timed out after 60000ms`
- **Meaning**: MCP query took too long (complex research)
- **Fix**: Increase timeout in mcp-proxy.ts or optimize query

**Error 5**: `503 Service Unavailable`
- **Meaning**: MCP gateway or backend server crashed/restarting
- **Fix**: Check MCP infrastructure health, may need restart

**Error 6**: `429 Too Many Requests`
- **Meaning**: API rate limit exceeded (Context7/Perplexity/BrightData)
- **Fix**: Implement request throttling or upgrade API plan

---

## Part 10: Next Steps After Successful Deployment

### Immediate Actions

1. **Update Documentation**:
   - Mark `FIX-CHECKLIST.md` as completed
   - Document new environment variables in README
   - Update deployment guide with MCP connection details

2. **Monitor for 24 Hours**:
   - Check health endpoint every hour
   - Review error logs for any unexpected issues
   - Verify API usage stays within quotas

3. **Enable Alerts** (Optional):
   - DigitalOcean: Set up email alerts for app downtime
   - External: Configure uptime monitoring (UptimeRobot, Pingdom)
   - Slack: Webhook for deployment notifications

### Future Enhancements

1. **Add Retry Logic**:
   - Implement exponential backoff for MCP calls
   - Add circuit breaker for failing services
   - Cache successful responses

2. **Improve Observability**:
   - Add structured logging (Winston, Pino)
   - Track MCP call latency and success rates
   - Create dashboard for research agent metrics

3. **Scale Infrastructure**:
   - Load test research agent with high query volume
   - Consider upgrading instance size if CPU/Memory constrained
   - Evaluate need for multiple replicas

---

## Contact Information

**Deployment Owner**: Charlie Fisher (charlie@seismicmvmt.com)
**Repository**: https://github.com/cfisher8565/research-agent-mvp
**Support**: File issues on GitHub or contact via DigitalOcean support

---

## Appendix A: Complete Environment Variables

### Research Agent MVP (5 variables)

```bash
# Required for agent to function
ANTHROPIC_API_KEY=sk-ant-oat01-...  # Claude API key for agent queries
MCP_SERVERS_URL=https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp
MCP_SHARED_SECRET=o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=

# Standard Node.js configuration
PORT=8080
NODE_ENV=production
```

### MCP Infrastructure (6 variables)

```bash
# Gateway authentication
MCP_SHARED_SECRET=o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=

# Backend service URLs (internal Docker network)
PERPLEXITY_URL=http://perplexity-mcp:8802
BRIGHTDATA_URL=http://brightdata-mcp:8803

# External hosted services
CONTEXT7_MCP_URL=https://mcp.context7.com/mcp
CONTEXT7_API_KEY=<encrypted>

# Standard configuration
PORT=8080
```

---

## Appendix B: Testing Script

Save as `/tmp/test-research-agent.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="https://research-agent-mvp-w8c42.ondigitalocean.app"

echo "=== Research Agent MVP - Validation Tests ==="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | grep -q '"status":"healthy"' && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 2: Tool Count
echo "Test 2: Tool Count"
TOOL_COUNT=$(echo "$HEALTH" | grep -o '"toolCount":[0-9]*' | grep -o '[0-9]*')
[ "$TOOL_COUNT" -eq 10 ] && echo "✅ PASS (10 tools)" || echo "❌ FAIL ($TOOL_COUNT tools)"
echo ""

# Test 3: Context7 Query
echo "Test 3: Context7 Query"
CONTEXT7=$(curl -s -X POST "$BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use Context7 to find TanStack Query"}')
echo "$CONTEXT7" | grep -q '"success":true' && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 4: Perplexity Query
echo "Test 4: Perplexity Query"
PERPLEXITY=$(curl -s -X POST "$BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use Perplexity to research Next.js 14"}')
echo "$PERPLEXITY" | grep -q '"success":true' && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 5: BrightData Query
echo "Test 5: BrightData Query"
BRIGHTDATA=$(curl -s -X POST "$BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use BrightData to scrape https://nextjs.org"}')
echo "$BRIGHTDATA" | grep -q '"success":true' && echo "✅ PASS" || echo "❌ FAIL"
echo ""

echo "=== All Tests Complete ==="
```

Run with:
```bash
chmod +x /tmp/test-research-agent.sh
/tmp/test-research-agent.sh
```

---

## Appendix C: Quick Reference Commands

```bash
# Health checks
curl https://research-agent-mvp-w8c42.ondigitalocean.app/health
curl https://mcp-infrastructure-rhvlk.ondigitalocean.app/health

# Get app info
doctl apps get e13e1c19-b542-422d-8c21-40c45b3bb982

# Get deployment status
doctl apps get-deployment e13e1c19-b542-422d-8c21-40c45b3bb982

# View logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type run

# Update app
doctl apps update e13e1c19-b542-422d-8c21-40c45b3bb982 --spec /path/to/spec.json

# List deployments (for rollback)
doctl apps list-deployments e13e1c19-b542-422d-8c21-40c45b3bb982
```

---

**End of Plan**

*This plan is ready for execution. All necessary information is provided for a successful deployment.*
