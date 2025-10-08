# Research Agent Architecture

## Native HTTP MCP Pattern (v2.0)

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│     Client (HTTP REST API)                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Research Agent (Express Server)            │
│  - Port 8080                                │
│  - Health checks                            │
│  - Query endpoint                           │
│  - Claude Agent SDK integration             │
└──────────┬─────────┬─────────┬──────────────┘
           │         │         │
           │         │         │
      ┌────▼────┐ ┌──▼───┐ ┌──▼────────┐
      │Context7 │ │Perpl.│ │BrightData │
      │(hosted) │ │(self)│ │(self)     │
      └─────────┘ └──────┘ └───────────┘
         2 tools   4 tools    4 tools
```

### Component Details

#### Research Agent (Express/TypeScript)
- **Framework**: Express.js
- **Language**: TypeScript
- **SDK**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **Port**: 8080 (configurable)
- **Endpoints**:
  - `GET /health` - Health check with MCP config status
  - `POST /query` - Research query processing

#### MCP Servers (3 servers, 10 tools)

**1. Context7 (Hosted)**
- **URL**: `https://mcp.context7.com/mcp`
- **Auth**: Bearer token (Authorization header)
- **Tools**: 2
  - `mcp__context7__resolve-library-id`
  - `mcp__context7__get-library-docs`
- **Purpose**: Official library documentation

**2. Perplexity (Self-hosted)**
- **URL**: `http://perplexity-mcp:8802/mcp`
- **Auth**: Shared secret (X-MCP-Secret header)
- **Tools**: 4
  - `perplexity_search`
  - `perplexity_ask`
  - `perplexity_research`
  - `perplexity_reason`
- **Purpose**: AI-powered research with citations

**3. BrightData (Self-hosted)**
- **URL**: `http://brightdata-mcp:8803/mcp`
- **Auth**: Shared secret (X-MCP-Secret header)
- **Tools**: 4
  - `mcp__brightdata__search_engine`
  - `mcp__brightdata__scrape_as_markdown`
  - `mcp__brightdata__scrape_batch`
  - `mcp__brightdata__search_engine_batch`
- **Purpose**: Web scraping and search

---

## Request Flow

### 1. Health Check Flow

```
Client
  ↓ GET /health
Agent
  ↓ Check environment variables
  ↓ Validate configuration
  ↓ Return status
Client
```

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
  }
}
```

### 2. Research Query Flow

```
Client
  ↓ POST /query {"prompt": "..."}
Agent
  ↓ Parse request
  ↓ Initialize Claude Agent SDK
  ↓ Connect to MCP servers (HTTP)
  ├─→ Context7 (if documentation needed)
  ├─→ Perplexity (if research needed)
  └─→ BrightData (if scraping needed)
  ↓ Process with Claude AI
  ↓ Aggregate results
  ↓ Return response
Client
```

**Example Request:**
```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Use Context7 to find TanStack Query v5 documentation"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "result": "Based on Context7 documentation...[detailed response]"
  }
}
```

---

## Authentication Flow

### Context7 (Bearer Token)

```
Agent → Context7
Headers:
  Authorization: Bearer c7_xxx...
  Content-Type: application/json
  Accept: application/json
```

### Perplexity & BrightData (Shared Secret)

```
Agent → MCP Server
Headers:
  X-MCP-Secret: your-secret-here
  Content-Type: application/json
  Accept: application/json
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│ Environment Variables (.env)                          │
├──────────────────────────────────────────────────────┤
│ ANTHROPIC_API_KEY=sk-ant-api03-...                   │
│ CONTEXT7_API_KEY=c7_...                              │
│ MCP_SHARED_SECRET=your-secret                        │
│ PERPLEXITY_MCP_URL=http://perplexity-mcp:8802/mcp   │
│ BRIGHTDATA_MCP_URL=http://brightdata-mcp:8803/mcp   │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│ Research Agent (server.ts)                           │
├──────────────────────────────────────────────────────┤
│                                                       │
│  query({                                             │
│    prompt: "...",                                    │
│    options: {                                        │
│      mcpServers: {                                   │
│        context7: {                                   │
│          type: 'http',                               │
│          url: 'https://mcp.context7.com/mcp',       │
│          headers: {                                  │
│            'Authorization': 'Bearer c7_xxx...'       │
│          }                                           │
│        },                                            │
│        perplexity: {                                 │
│          type: 'http',                               │
│          url: 'http://perplexity-mcp:8802/mcp',     │
│          headers: {                                  │
│            'X-MCP-Secret': 'your-secret'             │
│          }                                           │
│        },                                            │
│        brightdata: {                                 │
│          type: 'http',                               │
│          url: 'http://brightdata-mcp:8803/mcp',     │
│          headers: {                                  │
│            'X-MCP-Secret': 'your-secret'             │
│          }                                           │
│        }                                             │
│      }                                               │
│    }                                                 │
│  })                                                  │
│                                                       │
└───┬────────────────┬─────────────────┬───────────────┘
    │                │                 │
    ▼                ▼                 ▼
┌────────┐      ┌──────────┐     ┌───────────┐
│Context7│      │Perplexity│     │BrightData │
│(hosted)│      │  (self)  │     │  (self)   │
└────────┘      └──────────┘     └───────────┘
```

---

## Comparison: v1.0 vs v2.0

### v1.0 (Deprecated - stdio proxy)

```
Client
  ↓
Research Agent
  ↓ stdio
stdio-proxy.ts (Node process)
  ↓ HTTP
MCP Gateway (unified endpoint)
  ↓
Multiple MCP Servers
```

**Problems:**
- Extra process overhead
- Complex stdio ↔ HTTP serialization
- Single point of failure (proxy)
- Harder to debug
- Not industry standard

### v2.0 (Current - native HTTP)

```
Client
  ↓
Research Agent
  ├─ HTTP → Context7
  ├─ HTTP → Perplexity
  └─ HTTP → BrightData
```

**Benefits:**
- No proxy layer
- Direct HTTP connections
- Standard MCP pattern
- Better error isolation
- Easier debugging

---

## Technology Stack

### Core Dependencies

```json
{
  "@anthropic-ai/claude-agent-sdk": "^0.1.0",
  "express": "^4.18.2",
  "axios": "^1.6.8"
}
```

### Development Dependencies

```json
{
  "@types/express": "^4.17.21",
  "@types/node": "^22.0.0",
  "tsx": "^4.7.0",
  "typescript": "^5.8.3"
}
```

### Runtime Requirements

- **Node.js**: 18+ (ES modules support)
- **TypeScript**: 5.8.3
- **Docker**: Optional for containerization

---

## Network Architecture

### Docker Networking

```
┌─────────────────────────────────────────────┐
│  Docker Network: mcp-private                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐     ┌─────────────────┐ │
│  │ Research     │────▶│ Perplexity MCP  │ │
│  │ Agent        │     │ :8802           │ │
│  │ :8080        │     └─────────────────┘ │
│  └──┬───────────┘                         │
│     │             ┌─────────────────┐     │
│     └────────────▶│ BrightData MCP  │     │
│                   │ :8803           │     │
│                   └─────────────────┘     │
└─────────────────────────────────────────────┘
                    │
                    │ HTTPS (external)
                    ▼
            ┌───────────────┐
            │  Context7     │
            │  (hosted)     │
            └───────────────┘
```

### Port Mapping

- **8080**: Research Agent (HTTP API)
- **8802**: Perplexity MCP (internal)
- **8803**: BrightData MCP (internal)
- **443**: Context7 (HTTPS external)

---

## Error Handling

### Connection Errors

```typescript
// Individual MCP server failures don't affect others
try {
  // Call Context7
} catch (error) {
  // Continue with Perplexity/BrightData
}
```

### Authentication Errors

```typescript
// Clear error messages per server
if (!process.env.CONTEXT7_API_KEY) {
  throw new Error('Context7 API key not configured');
}
```

### Health Check Validation

```typescript
// Verify configuration before accepting requests
{
  "mcp": {
    "success": false,  // Overall status
    "configured": {
      "context7": false,  // Missing API key
      "perplexity": true,
      "brightdata": true,
      "sharedSecret": true
    }
  }
}
```

---

## Performance Characteristics

### Latency

- **Health Check**: <10ms (no external calls)
- **Query Processing**: 2-10s (depends on MCP tools used)
- **Context7 Lookup**: 500-2000ms
- **Perplexity Research**: 3-8s
- **BrightData Scraping**: 1-5s per page

### Throughput

- **Concurrent Requests**: Limited by Anthropic API rate limits
- **MCP Server Connections**: Independent, parallel processing
- **Memory Usage**: ~50-100MB per agent instance

### Scalability

- **Horizontal Scaling**: Multiple agent instances
- **MCP Server Isolation**: Scale each independently
- **No Shared State**: Stateless design

---

## Security Considerations

### Authentication

- **Context7**: Bearer token (OAuth-style)
- **Self-hosted**: Shared secret (custom auth)
- **No authentication bypass**: Required for all requests

### Network Security

- **Private Network**: Self-hosted MCP servers on private network
- **HTTPS**: Context7 uses encrypted transport
- **Secret Management**: Environment variables only

### API Key Rotation

```bash
# Rotate Context7 API key
1. Generate new key at context7.com
2. Update CONTEXT7_API_KEY environment variable
3. Restart agent

# Rotate shared secret
1. Update MCP_SHARED_SECRET on all servers
2. Restart all containers simultaneously
```

---

## Monitoring & Observability

### Health Checks

```bash
# Check agent health
curl http://localhost:8080/health

# Check MCP server health
curl http://perplexity-mcp:8802/health
curl http://brightdata-mcp:8803/health
```

### Logs

```bash
# Agent logs
docker logs -f research-agent-mvp

# MCP server logs
docker logs -f perplexity-mcp
docker logs -f brightdata-mcp
```

### Metrics (Future)

- Request count per endpoint
- Query success/failure rate
- MCP tool usage statistics
- Response time percentiles

---

## Deployment Patterns

### Development (Local)

```bash
npm run dev  # tsx watch mode
```

### Production (Docker)

```bash
docker build -t research-agent-mvp .
docker run -p 8080:8080 --env-file .env research-agent-mvp
```

### Cloud (DigitalOcean App Platform)

```yaml
services:
  - name: research-agent-mvp
    github:
      repo: your-org/research-agent-mvp
      branch: main
    envs:
      - key: ANTHROPIC_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: CONTEXT7_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: MCP_SHARED_SECRET
        scope: RUN_TIME
        type: SECRET
```

---

## References

- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Context7 MCP Server](https://mcp.context7.com)
- [Migration Guide](./MIGRATION-GUIDE.md)

---

_Last Updated: October 8, 2025_
_Architecture Version: 2.0 (Native HTTP MCP)_
