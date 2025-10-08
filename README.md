# Research Agent MVP

**Remote Claude Agent with Native HTTP MCP Support**

> **⚠️ BREAKING CHANGE (Oct 8, 2025)**: Updated to use native HTTP MCP connections. See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for details.

## Architecture

This agent uses **native HTTP MCP support** (Claude Agent SDK Oct 1, 2025+) to connect directly to three research services:

- **Context7** (hosted): Library documentation lookup
- **Perplexity** (self-hosted): AI-powered research with citations
- **BrightData** (self-hosted): Web scraping and search

**Total: 10 MCP tools** accessible to the research agent.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit with your API keys
nano .env
```

**Required variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
CONTEXT7_API_KEY=c7_...
MCP_SHARED_SECRET=your-secret-here
```

### 3. Run Locally (Development)
```bash
# Build TypeScript
npm run build

# Start server
npm start
```

### 4. Test Endpoints
```bash
# Health check - verify MCP configuration
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
  }
}

# Research query with Context7
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use Context7 to find TanStack Query v5 mutations documentation"}'

# Research query with Perplexity
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use Perplexity to research Next.js 14 App Router best practices"}'

# Web scraping with BrightData
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use BrightData to scrape https://nextjs.org/docs"}'
```

### 5. Docker Deployment
```bash
# Build image
docker build -t research-agent-mvp .

# Run container (pass environment variables)
docker run -p 8080:8080 \
  -e ANTHROPIC_API_KEY="sk-ant-api03-..." \
  -e CONTEXT7_API_KEY="c7_..." \
  -e MCP_SHARED_SECRET="your-secret" \
  -e PERPLEXITY_MCP_URL="http://perplexity-mcp:8802/mcp" \
  -e BRIGHTDATA_MCP_URL="http://brightdata-mcp:8803/mcp" \
  research-agent-mvp

# Or use .env file
docker run -p 8080:8080 --env-file .env research-agent-mvp
```

## API Reference

### POST /query
**Request:**
```json
{
  "prompt": "Your research query here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": "Agent response...",
    "messageCount": 3
  }
}
```

### GET /health
**Response:**
```json
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

## Environment Variables

**Required:**
- `ANTHROPIC_API_KEY`: Claude Agent SDK API key
- `CONTEXT7_API_KEY`: Context7 MCP server API key
- `MCP_SHARED_SECRET`: Shared secret for self-hosted MCP servers

**Optional (with defaults):**
- `PORT`: HTTP port (default: 8080)
- `PERPLEXITY_MCP_URL`: Perplexity server URL (default: `http://perplexity-mcp:8802/mcp`)
- `BRIGHTDATA_MCP_URL`: BrightData server URL (default: `http://brightdata-mcp:8803/mcp`)
- `NODE_ENV`: Environment mode (default: production)

See [.env.example](./.env.example) for complete configuration.

## MCP Tools Available

The research agent has access to **10 MCP tools** across 3 servers:

**Context7 (2 tools):**
- `mcp__context7__resolve-library-id` - Find library documentation
- `mcp__context7__get-library-docs` - Get specific documentation

**Perplexity (4 tools):**
- `perplexity_search` - Quick web search
- `perplexity_ask` - Q&A with citations
- `perplexity_research` - Deep research
- `perplexity_reason` - Complex analysis

**BrightData (4 tools):**
- `mcp__brightdata__search_engine` - SERP results
- `mcp__brightdata__scrape_as_markdown` - Scrape webpage
- `mcp__brightdata__scrape_batch` - Batch scraping
- `mcp__brightdata__search_engine_batch` - Batch search

## Features

**Current (v2.0):**
- ✅ Native HTTP MCP support (no stdio bridges)
- ✅ Direct connections to 3 MCP servers
- ✅ 10 research tools accessible
- ✅ TypeScript Express server
- ✅ Claude Agent SDK integration
- ✅ Docker containerization
- ✅ Health checks with config validation
- ✅ Environment-based configuration

**Future:**
- ⏳ Authentication middleware
- ⏳ Rate limiting
- ⏳ Request logging
- ⏳ Metrics/monitoring
- ⏳ Kubernetes deployment

## Migration from v1.0

If you're upgrading from the stdio proxy version (v1.0), see [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for:
- Breaking changes
- Environment variable updates
- Architecture changes
- Testing procedures

## Documentation

- [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - Migration from stdio proxy to native HTTP
- [CHANGELOG-HTTP-NATIVE.md](./CHANGELOG-HTTP-NATIVE.md) - Detailed changelog
- [.env.example](./.env.example) - Environment variable reference

## Troubleshooting

**Health check shows `configured: false`:**
```bash
# Verify environment variables are set
printenv | grep -E "(ANTHROPIC|CONTEXT7|MCP_SHARED_SECRET)"

# Check .env file
cat .env
```

**Connection errors:**
```bash
# Verify MCP servers are accessible
curl http://perplexity-mcp:8802/health
curl http://brightdata-mcp:8803/health

# Check Docker networking
docker network inspect <network-name>
```

**Authentication errors:**
- Context7: Verify API key format starts with `c7_`
- Self-hosted: Ensure `MCP_SHARED_SECRET` matches across all servers

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md#troubleshooting) for more details.
