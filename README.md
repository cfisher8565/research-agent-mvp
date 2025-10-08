# Research Agent MVP

**Simple remote SDK agent to ship TODAY!**

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally (Development)
```bash
# Set your OAuth token
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."

# Start development server
npm run dev
```

### 3. Test Endpoint
```bash
# Health check
curl http://localhost:8080/health

# Query endpoint
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is TanStack Query?"}'
```

### 4. Build Docker Container
```bash
# Build image
docker build -t research-agent-mvp .

# Run container
docker run -p 8080:8080 \
  -e CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..." \
  research-agent-mvp
```

### 5. Test Docker Container
```bash
# Health check
curl http://localhost:8080/health

# Query with Context7
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Research TanStack Query v5 patterns"}'
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
  "timestamp": "2025-10-08T..."
}
```

## Environment Variables

- `CLAUDE_CODE_OAUTH_TOKEN` (required): Your Claude OAuth token
- `PORT` (optional): HTTP port (default: 8080)

## MVP Scope

This MVP includes:
- ✅ TypeScript Express server
- ✅ Claude Agent SDK integration
- ✅ POST /query endpoint
- ✅ Context7 MCP server
- ✅ Docker containerization
- ✅ Health checks

NOT included (add later):
- ❌ Authentication
- ❌ DigitalOcean deployment
- ❌ Kubernetes
- ❌ Monitoring
- ❌ Multiple MCP servers
