# Research Agent MVP - Architecture State Diagram

**Visual representation of current vs. desired state**

---

## Current State (BROKEN)

```
┌─────────────────────────────────────────────────────────────┐
│ Research Agent MVP                                          │
│ https://research-agent-mvp-w8c42.ondigitalocean.app         │
│                                                             │
│ Status: 503 ERROR (no_healthy_upstream)                    │
│ Health: /health → HTTP 503                                 │
│ Config: MCP_SERVERS_URL → WRONG URL (deleted app)          │
│         MCP_SHARED_SECRET → MISSING                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Attempting to connect to...
                       │
                       ▼
        ╔══════════════════════════════╗
        ║ ❌ mcp-servers-app (DELETED) ║
        ║ https://mcp-servers-app-     ║
        ║ ng8oh.ondigitalocean.app/mcp ║
        ║                              ║
        ║ Status: 404 NOT FOUND        ║
        ╚══════════════════════════════╝

Legend:
  ❌ = Not working
  ⚠️ = Partial functionality
  ✅ = Working correctly
```

---

## Desired State (AFTER FIX)

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Research Agent MVP                                        │
│ https://research-agent-mvp-w8c42.ondigitalocean.app         │
│                                                             │
│ Status: HEALTHY                                             │
│ Health: /health → {"status":"healthy","mcp":{"toolCount":10}}│
│ Config: MCP_SERVERS_URL → CORRECT URL                       │
│         MCP_SHARED_SECRET → SET                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP POST with X-MCP-Secret header
                       │
                       ▼
        ┌──────────────────────────────┐
        │ ⚠️ MCP Gateway                │ ← BLOCKER HERE
        │ https://mcp-infrastructure-  │
        │ rhvlk.ondigitalocean.app/mcp │
        │                              │
        │ Status: HEALTHY BUT PARTIAL  │
        │ Tools: 1/10 (expected 10+)   │
        └──────────┬───────────────────┘
                   │
        ┌──────────┴──────────┬───────────────┐
        │                     │               │
        ▼                     ▼               ▼
┌───────────────┐   ┌─────────────┐   ┌───────────────┐
│❓Context7     │   │⚠️Perplexity  │   │⚠️BrightData   │
│(External)     │   │(Internal)   │   │(Internal)     │
│               │   │             │   │               │
│https://mcp.   │   │http://      │   │http://        │
│context7.com/  │   │perplexity-  │   │brightdata-    │
│mcp            │   │mcp:8802/mcp │   │mcp:8803/mcp   │
│               │   │             │   │               │
│Expected: 2    │   │Expected: 4  │   │Expected: 4    │
│Actual: ???    │   │Actual: 1    │   │Actual: ???    │
│               │   │(placeholder)│   │               │
└───────────────┘   └─────────────┘   └───────────────┘

Legend:
  ✅ = Working correctly
  ⚠️ = Partial functionality (needs investigation)
  ❓ = Unknown state (needs testing)
```

---

## Target State (FULLY WORKING)

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Research Agent MVP                                        │
│ https://research-agent-mvp-w8c42.ondigitalocean.app         │
│                                                             │
│ Status: HEALTHY & FUNCTIONAL                                │
│ Health: /health → {"status":"healthy","mcp":{"toolCount":10}}│
│ Query: /query → Returns research results                    │
│ Config: MCP_SERVERS_URL → ✅ Correct URL                     │
│         MCP_SHARED_SECRET → ✅ Set & matching                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP POST with X-MCP-Secret header
                       │ Authentication: ✅ Working
                       │
                       ▼
        ┌──────────────────────────────┐
        │ ✅ MCP Gateway                │
        │ https://mcp-infrastructure-  │
        │ rhvlk.ondigitalocean.app/mcp │
        │                              │
        │ Status: HEALTHY & COMPLETE   │
        │ Tools: 10+ (all backends)    │
        │ Auth: X-MCP-Secret validated │
        └──────────┬───────────────────┘
                   │
                   │ Aggregates tools from all backends
                   │
        ┌──────────┴──────────┬───────────────┐
        │                     │               │
        ▼                     ▼               ▼
┌───────────────┐   ┌─────────────┐   ┌───────────────┐
│✅ Context7    │   │✅ Perplexity │   │✅ BrightData  │
│(Hosted)       │   │(Container)  │   │(Container)    │
│               │   │             │   │               │
│https://mcp.   │   │http://      │   │http://        │
│context7.com/  │   │perplexity-  │   │brightdata-    │
│mcp            │   │mcp:8802/mcp │   │mcp:8803/mcp   │
│               │   │             │   │               │
│Tools: 2 ✅    │   │Tools: 4 ✅  │   │Tools: 4 ✅    │
│- resolve-id   │   │- search     │   │- search_engine│
│- get-docs     │   │- ask        │   │- scrape       │
│               │   │- research   │   │- scrape_batch │
│               │   │- reason     │   │- search_batch │
└───────────────┘   └─────────────┘   └───────────────┘

Total: 10 tools accessible from Research Agent
```

---

## Request Flow (Target State)

### Example: Context7 Library Lookup

```
User Request
     │
     ▼
POST /query {"prompt": "Use Context7 to find TanStack Query"}
     │
     ▼
┌─────────────────────────────────────────┐
│ Research Agent MVP                      │
│ - Parses prompt                         │
│ - Calls Claude Agent SDK                │
│ - SDK uses mcp-proxy.js (stdio→HTTP)   │
└────────────┬────────────────────────────┘
             │
             ▼ HTTP POST /mcp
┌─────────────────────────────────────────┐
│ MCP Gateway                             │
│ - Validates X-MCP-Secret header ✅      │
│ - Routes to Context7 backend           │
│ - Adds Authorization: Bearer header    │
└────────────┬────────────────────────────┘
             │
             ▼ HTTP POST
┌─────────────────────────────────────────┐
│ Context7 MCP Server (Hosted)           │
│ - Receives tools/call request          │
│ - Executes resolve-library-id          │
│ - Returns library ID: /tanstack/query  │
└────────────┬────────────────────────────┘
             │
             ▼ Response bubbles back
┌─────────────────────────────────────────┐
│ Research Agent MVP                      │
│ - Receives result from SDK              │
│ - Formats response                      │
│ - Returns to user                       │
└────────────┬────────────────────────────┘
             │
             ▼
{"success": true, "data": {"result": "Library ID: /tanstack/query"}}
```

---

## Network Topology

### Current Setup (DigitalOcean Frankfurt Region)

```
┌────────────────────────────────────────────────────────────┐
│ DigitalOcean App Platform (fra region)                    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ mcp-infrastructure App                           │    │
│  │ App ID: e039c351-056f-45ab-ae40-abe02173c25a     │    │
│  │                                                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  │    │
│  │  │ gateway    │  │ perplexity │  │brightdata│  │    │
│  │  │ :8080      │  │ :8802      │  │ :8803    │  │    │
│  │  │ (public)   │  │ (internal) │  │(internal)│  │    │
│  │  └────────────┘  └────────────┘  └──────────┘  │    │
│  │       │                │                │       │    │
│  │       └────────────────┴────────────────┘       │    │
│  │            Internal Docker Network              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ research-agent-mvp App                           │    │
│  │ App ID: e13e1c19-b542-422d-8c21-40c45b3bb982     │    │
│  │                                                  │    │
│  │  ┌────────────────────────────────────────────┐ │    │
│  │  │ research-agent :8080 (public)              │ │    │
│  │  │ Currently: DOWN (pointing to wrong URL)    │ │    │
│  │  │ After fix: Connects to gateway above ──────┼─┼────┼──> mcp-infrastructure
│  │  └────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘

External Services:
┌────────────────────────────────────────┐
│ Context7 MCP Server (Hosted)          │
│ https://mcp.context7.com/mcp           │
│ Accessed by: gateway ────────────────> │
│ Auth: Authorization: Bearer <KEY>      │
└────────────────────────────────────────┘
```

---

## Authentication Flow

### Current (BROKEN)

```
Research Agent
      │
      │ Missing X-MCP-Secret header
      │ Wrong URL (404)
      ▼
   ❌ FAIL
```

### Target (WORKING)

```
Research Agent
      │
      │ 1. HTTP POST /mcp
      │    Headers: X-MCP-Secret: o4SyP8A...
      ▼
MCP Gateway
      │
      │ 2. Validate secret
      │    Expected: o4SyP8A... ✅ Match
      │
      ├──> If match: Continue
      │
      │ 3. Route to backend
      │    Add backend auth (Context7: Bearer token)
      ▼
Backend MCP Server
      │
      │ 4. Execute tool
      │    Return result
      ▼
Response flows back through gateway to agent
```

---

## Environment Variables Map

### Research Agent (5 variables)

```
┌─────────────────────────────────────────────────────────────┐
│ research-agent-mvp Environment Variables                    │
├─────────────────────────────────────────────────────────────┤
│ ANTHROPIC_API_KEY       → sk-ant-oat01-... (SECRET)        │
│ MCP_SERVERS_URL         → https://mcp-infrastructure-...   │
│ MCP_SHARED_SECRET       → o4SyP8A... (SECRET) ← MISSING    │
│ PORT                    → 8080                              │
│ NODE_ENV                → production                        │
└─────────────────────────────────────────────────────────────┘
```

### MCP Gateway (6 variables)

```
┌─────────────────────────────────────────────────────────────┐
│ mcp-infrastructure Environment Variables                    │
├─────────────────────────────────────────────────────────────┤
│ MCP_SHARED_SECRET       → o4SyP8A... (SECRET) ✅ SET        │
│ CONTEXT7_MCP_URL        → https://mcp.context7.com/mcp ✅   │
│ CONTEXT7_API_KEY        → <encrypted> (SECRET) ✅           │
│ PERPLEXITY_URL          → http://perplexity-mcp:8802 ✅     │
│ BRIGHTDATA_URL          → http://brightdata-mcp:8803 ✅     │
│ PORT                    → 8080 ✅                           │
└─────────────────────────────────────────────────────────────┘

Backend-specific:
┌─────────────────────────────────────────────────────────────┐
│ perplexity-mcp: PERPLEXITY_API_KEY → <encrypted> ✅         │
│ brightdata-mcp: BRIGHTDATA_API_TOKEN → <encrypted> ✅       │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Timeline

### Phase 1: Gateway Diagnosis (15-30 minutes)

```
[Start] → Check gateway logs → Identify backend failures → Root cause analysis
                                                                    │
                                                                    ▼
                                                              [Decision Point]
```

### Phase 2: Gateway Fix (30-120 minutes)

```
[Decision Point]
      │
      ├─> Backend MCP incomplete → Implement full protocol (1-2 hours)
      │
      ├─> Network routing broken → Fix Docker networking (30 min)
      │
      ├─> API keys invalid → Update environment variables (15 min)
      │
      └─> Multiple issues → Address each sequentially
                                    │
                                    ▼
                              [Gateway Verified]
                              toolCount: 10+
```

### Phase 3: Research Agent Deployment (10 minutes)

```
[Gateway Verified]
      │
      ├─> Update source code (5 min)
      │   - src/server.ts
      │   - src/mcp-proxy.ts
      │   - src/mcp-client.ts
      │
      ├─> Commit & push (1 min)
      │
      ├─> Update DigitalOcean app (2 min)
      │   - Add MCP_SERVERS_URL
      │   - Add MCP_SHARED_SECRET
      │
      ├─> Wait for deployment (2 min)
      │
      └─> Validate (30 sec)
            │
            ▼
      [Fully Functional]
```

---

## Success Metrics

### Health Check Response

**Before Fix**:
```json
HTTP 503 Service Unavailable
(Error page HTML)
```

**After Fix**:
```json
HTTP 200 OK
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

### Query Response

**Before Fix**:
```
Cannot connect to server
```

**After Fix**:
```json
HTTP 200 OK
{
  "success": true,
  "data": {
    "result": "Based on Context7 documentation, TanStack Query library ID is /tanstack/query..."
  }
}
```

---

**End of Architecture State Diagram**

*This document provides visual representation of current state, desired state, and path to success.*
