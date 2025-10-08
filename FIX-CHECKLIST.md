# Research Agent MVP - Fix Checklist

**Status**: 🔴 BLOCKING BUG - Cannot connect to MCP tools
**Time to Fix**: ~10 minutes + rebuild + test
**Impact**: CRITICAL - Application is non-functional without this fix

---

## The Problem

**Wrong URL**: `https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp` (404 - Does not exist)
**Correct URL**: `https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp` (Active and healthy)
**Missing Auth**: No `X-MCP-Secret` header (gateway requires authentication)

---

## Fix Checklist

### ✅ Step 1: Update MCP Server URLs (3 files)

**File 1: `src/server.ts` (Line 108)**
```diff
- MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp'
+ MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp'
```

**File 2: `src/mcp-proxy.ts` (Line 13)**
```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
```

**File 3: `src/mcp-client.ts` (Line 10)**
```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
```

---

### ✅ Step 2: Add Authentication (2 files)

**File 1: `src/mcp-proxy.ts` (Add to headers after line 35)**
```diff
  const response = await axios.post(MCP_SERVER_URL, request, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
+     'X-MCP-Secret': process.env.MCP_SHARED_SECRET || ''
    },
```

**File 2: `src/mcp-client.ts` (Add to headers in 2 places: lines 35-38 and 130-133)**
```diff
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
+   'X-MCP-Secret': process.env.MCP_SHARED_SECRET || ''
  };
```

---

### ✅ Step 3: Set Environment Variables

**Local Development** (.env or export):
```bash
export MCP_SERVERS_URL="https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp"
export MCP_SHARED_SECRET="o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs="
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."  # Your existing token
```

**Docker Run**:
```bash
docker run -p 8080:8080 \
  -e CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..." \
  -e MCP_SERVERS_URL="https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp" \
  -e MCP_SHARED_SECRET="o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=" \
  research-agent-mvp
```

---

### ✅ Step 4: Rebuild and Test

```bash
# Rebuild TypeScript
npm run build

# Start server
npm run dev

# In another terminal, test health check
curl http://localhost:8080/health

# Expected: "mcp": { "success": true, "toolCount": 10, "tools": [...] }
```

---

## Test Commands

### Test 1: Health Check (Should show 10 tools)
```bash
curl http://localhost:8080/health | jq
```

**Expected**:
```json
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
  }
}
```

### Test 2: Context7 Tool
```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use Context7 to find the library ID for TanStack Query"}'
```

### Test 3: Perplexity Tool
```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use Perplexity to research Next.js 14 App Router patterns"}'
```

---

## Validation Criteria

✅ Health check returns `"success": true`
✅ Tool count shows 10 (not 0)
✅ All 10 tool names listed
✅ Query endpoint works without errors
✅ Context7 tools return library documentation
✅ Perplexity tools return research results
✅ BrightData tools return scraped content

---

## Files Changed Summary

**Source Code** (5 changes):
- ✅ `src/server.ts` - Line 108 (URL)
- ✅ `src/mcp-proxy.ts` - Line 13 (URL), Line 35 (Auth)
- ✅ `src/mcp-client.ts` - Line 10 (URL), Lines 35-38 (Auth), Lines 130-133 (Auth)

**Environment** (1 addition):
- ✅ Add `MCP_SHARED_SECRET` to all deployment configs

**Total Changes**: 5 code edits + 1 environment variable

---

## After Fix

Once fixed, the application will:
- ✅ Successfully connect to deployed MCP infrastructure
- ✅ Access all 10 MCP tools (Context7, Perplexity, BrightData)
- ✅ Enable remote research capabilities via HTTP API
- ✅ Support parallel execution and context optimization

---

## Need Help?

See detailed analysis: `/remote-agents/docs/RESEARCH-AGENT-MVP-ANALYSIS.md`
