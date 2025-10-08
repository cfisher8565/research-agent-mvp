# Migration Guide: Native HTTP MCP Support

## Overview

As of **October 1, 2025**, the Claude Agent SDK supports native HTTP MCP connections. This eliminates the need for stdio bridges and proxies.

## What Changed?

### Before (Deprecated)

```typescript
// Required stdio proxy to bridge HTTP MCP servers
mcpServers: {
  unified: {
    type: 'stdio',
    command: 'node',
    args: ['./dist/mcp-proxy.js'],
    env: {
      MCP_SERVERS_URL: 'https://mcp-servers-app.ondigitalocean.app/mcp'
    }
  }
}
```

**Problems:**
- Required custom stdio → HTTP proxy (`mcp-proxy.ts`)
- Extra process overhead
- Complex error handling
- Single gateway endpoint (all MCP servers behind one URL)

### After (Current)

```typescript
// Direct HTTP connections to each MCP server
mcpServers: {
  // Context7 (hosted)
  context7: {
    type: 'http',
    url: 'https://mcp.context7.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.CONTEXT7_API_KEY}`
    }
  },
  // Perplexity (self-hosted)
  perplexity: {
    type: 'http',
    url: process.env.PERPLEXITY_MCP_URL || 'http://perplexity-mcp:8802/mcp',
    headers: {
      'X-MCP-Secret': process.env.MCP_SHARED_SECRET
    }
  },
  // BrightData (self-hosted)
  brightdata: {
    type: 'http',
    url: process.env.BRIGHTDATA_MCP_URL || 'http://brightdata-mcp:8803/mcp',
    headers: {
      'X-MCP-Secret': process.env.MCP_SHARED_SECRET
    }
  }
}
```

**Benefits:**
- ✅ No stdio proxy needed
- ✅ Direct HTTP connections
- ✅ Individual server authentication
- ✅ Better error isolation
- ✅ Simpler architecture
- ✅ Industry standard pattern

## Files Modified

### 1. `src/server.ts`
- ✅ Updated to use native HTTP MCP connections
- ✅ Removed stdio proxy dependency
- ✅ Added environment variable checks in health endpoint
- ✅ Cleaner code with less indirection

### 2. `src/mcp-client.ts`
- ⚠️ **DEPRECATED** - Marked for reference only
- No longer imported by `server.ts`
- Keep for understanding previous architecture

### 3. `src/mcp-proxy.ts`
- ⚠️ **DEPRECATED** - Marked for reference only
- stdio → HTTP bridge no longer needed
- Keep for understanding previous architecture

### 4. `.env.example` (NEW)
- ✅ Documents all required environment variables
- ✅ Clear examples for each MCP server
- ✅ Default values for Docker networking

## Environment Variables

### Required

```bash
# Anthropic API Key (Claude Agent SDK)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Context7 API Key (hosted MCP server)
CONTEXT7_API_KEY=c7_...

# Shared secret for self-hosted MCP servers
MCP_SHARED_SECRET=your-secret-here
```

### Optional (defaults provided)

```bash
# Perplexity MCP Server URL
PERPLEXITY_MCP_URL=http://perplexity-mcp:8802/mcp

# BrightData MCP Server URL
BRIGHTDATA_MCP_URL=http://brightdata-mcp:8803/mcp

# Server port
PORT=8080
```

## Testing the Changes

### 1. Local Testing (Docker)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env

# Build and run
npm run build
npm start

# Test health endpoint
curl http://localhost:8080/health

# Expected response:
{
  "status": "healthy",
  "agent": "research-mvp",
  "mcp": {
    "success": true,
    "configured": {
      "context7": true,
      "perplexity": true,
      "brightdata": true,
      "sharedSecret": true
    }
  },
  "timestamp": "2025-10-08T..."
}
```

### 2. Test Research Query

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use Context7 to find documentation for TanStack Query v5 mutations"
  }'
```

### 3. Verify MCP Tool Access

The agent should now have access to all 10 MCP tools:

**Context7 (2 tools):**
- `mcp__context7__resolve-library-id`
- `mcp__context7__get-library-docs`

**Perplexity (4 tools):**
- `perplexity_search`
- `perplexity_ask`
- `perplexity_research`
- `perplexity_reason`

**BrightData (4 tools):**
- `mcp__brightdata__search_engine`
- `mcp__brightdata__scrape_as_markdown`
- `mcp__brightdata__scrape_batch`
- `mcp__brightdata__search_engine_batch`

## Deployment Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Fill in `ANTHROPIC_API_KEY`
- [ ] Fill in `CONTEXT7_API_KEY`
- [ ] Fill in `MCP_SHARED_SECRET`
- [ ] Update `PERPLEXITY_MCP_URL` if using external deployment
- [ ] Update `BRIGHTDATA_MCP_URL` if using external deployment
- [ ] Build TypeScript: `npm run build`
- [ ] Test locally: `npm start`
- [ ] Verify health endpoint returns all `configured: true`
- [ ] Test research query with Context7
- [ ] Test research query with Perplexity
- [ ] Test research query with BrightData

## Architecture Changes

### Before (Legacy)

```
Agent (server.ts)
  ↓
stdio proxy (mcp-proxy.ts)
  ↓
HTTP Gateway (unified endpoint)
  ↓
3 MCP Servers (Context7, Perplexity, BrightData)
```

### After (Current)

```
Agent (server.ts)
  ├→ Context7 (https://mcp.context7.com/mcp) - direct HTTP
  ├→ Perplexity (http://perplexity-mcp:8802/mcp) - direct HTTP
  └→ BrightData (http://brightdata-mcp:8803/mcp) - direct HTTP
```

## Benefits of Native HTTP

1. **Simpler Architecture**
   - No stdio bridge process
   - Fewer moving parts
   - Less complexity

2. **Better Performance**
   - Direct HTTP connections
   - No serialization overhead
   - Parallel MCP server access

3. **Improved Reliability**
   - No proxy process to fail
   - Better error messages
   - Individual server health checks

4. **Industry Standard**
   - HTTP is the standard MCP transport
   - Better tooling support
   - Easier debugging

5. **Authentication per Server**
   - Context7 uses Bearer token
   - Self-hosted servers use shared secret
   - Granular access control

## Troubleshooting

### Health check shows `configured: false`

```bash
# Check environment variables are set
echo $CONTEXT7_API_KEY
echo $MCP_SHARED_SECRET

# Verify .env file is loaded
source .env
npm start
```

### Connection refused errors

```bash
# Verify MCP servers are running
curl http://perplexity-mcp:8802/health
curl http://brightdata-mcp:8803/health

# Check Docker network connectivity
docker network ls
docker network inspect <network-name>
```

### Authentication errors

```bash
# Context7: Verify API key format
CONTEXT7_API_KEY=c7_...

# Self-hosted: Ensure shared secret matches
MCP_SHARED_SECRET=same-secret-on-all-servers
```

## Migration Timeline

- **October 1, 2025**: Claude Agent SDK adds native HTTP support
- **October 8, 2025**: research-agent-mvp updated to use native HTTP
- **Deprecated**: `mcp-proxy.ts`, `mcp-client.ts`, stdio bridge pattern
- **Recommended**: Remove deprecated files after validation period

## References

- [Claude Agent SDK Documentation](https://github.com/anthropics/claude-agent-sdk)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Context7 MCP Server](https://mcp.context7.com)
- [BrightData MCP Documentation](https://www.brightdata.com/products/scraping-browser)
- [Perplexity MCP Server](https://github.com/perplexityai/modelcontextprotocol)

---

**Last Updated**: October 8, 2025
**Migration Status**: ✅ Complete
**Next Steps**: Deploy and validate in production
