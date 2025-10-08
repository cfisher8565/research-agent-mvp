# Deploy Research Agent to DigitalOcean

**Quick deployment guide for Research Agent MVP**

---

## Prerequisites

1. **DigitalOcean Account** with API token
2. **doctl CLI** installed and authenticated
3. **CLAUDE_CODE_OAUTH_TOKEN** ready

---

## Option 1: Deploy via App Platform (Recommended)

### Step 1: Update app.yaml

Edit `.do/app.yaml` and update:

```yaml
github:
  repo: your-org/seismic-core  # ← Update this
  branch: main                   # ← Or your branch
```

### Step 2: Set Secret Environment Variable

```bash
# Update the CLAUDE_CODE_OAUTH_TOKEN in app.yaml
# Or set it after deployment via:
doctl apps update <APP_ID> --env CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

### Step 3: Create the App

```bash
cd /Users/charliefisher/Desktop/seismic-core\(Tue\,\ Sept30\)/remote-agents/research-agent-mvp

# Create app from spec
doctl apps create --spec .do/app.yaml
```

### Step 4: Monitor Deployment

```bash
# List apps
doctl apps list

# Get app ID from the list, then check deployment status
doctl apps get <APP_ID>

# View logs
doctl apps logs <APP_ID> --follow
```

### Step 5: Get Internal URL

```bash
# Once deployed, get the internal URL
doctl apps get <APP_ID> --format ID,DefaultIngress

# Internal URL will be: research-agent.ondigitalocean.app
```

---

## Option 2: Deploy via Container Registry + Droplet

### Step 1: Build and Push Docker Image

```bash
# Authenticate with DO Container Registry
doctl registry login

# Build image
docker build -t research-agent-mvp .

# Tag for registry
docker tag research-agent-mvp registry.digitalocean.com/your-registry/research-agent:latest

# Push to registry
docker push registry.digitalocean.com/your-registry/research-agent:latest
```

### Step 2: Create Droplet

```bash
# Create droplet with Docker pre-installed (Frankfurt region)
doctl compute droplet create research-agent \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region fra1 \
  --enable-private-networking \
  --ssh-keys YOUR_SSH_KEY_ID
```

### Step 3: SSH and Deploy

```bash
# SSH into droplet
doctl compute ssh research-agent

# Pull and run container
docker login registry.digitalocean.com
docker pull registry.digitalocean.com/your-registry/research-agent:latest

docker run -d \
  --name research-agent \
  --restart unless-stopped \
  -p 8080:8080 \
  -e CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..." \
  registry.digitalocean.com/your-registry/research-agent:latest

# Verify it's running
docker ps
curl http://localhost:8080/health
```

---

## Option 3: Local Testing First (Fastest)

Before deploying to production, test locally:

```bash
cd /Users/charliefisher/Desktop/seismic-core\(Tue\,\ Sept30\)/remote-agents/research-agent-mvp

# Set token
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."

# Run locally
npm run dev

# Test in another terminal
curl http://localhost:8080/health
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Research TanStack Query v5 patterns"}'
```

---

## Production Configuration

### Private VPC Setup (No Authentication Needed)

When deploying all three tool agents:

```
DigitalOcean Private VPC
├── Research Agent (:8080)
│   └── Internal URL: http://research-agent:8080
├── Task Master Agent (:8081)
│   └── Internal URL: http://taskmaster-agent:8081
└── Playwright Agent (:8082)
    └── Internal URL: http://playwright-agent:8082
```

**All agents on private network = no authentication required**

### Environment Variables

Set these in App Platform or Droplet:

- `CLAUDE_CODE_OAUTH_TOKEN` - **Required** (get from Claude Code CLI)
- `PORT` - Optional (defaults to 8080)
- `NODE_ENV` - Optional (defaults to production)

---

## Testing Deployed Agent

### Health Check

```bash
# Replace with your actual URL
curl https://research-agent-mvp-xxx.ondigitalocean.app/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "agent": "research-mvp",
  "timestamp": "2025-10-08T..."
}
```

### Query Endpoint

```bash
curl -X POST https://research-agent-mvp-xxx.ondigitalocean.app/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find Context7 library ID for Next.js"}'
```

**Expected response**:
```json
{
  "success": true,
  "data": {
    "result": "The Context7 library ID for Next.js is /vercel/next.js...",
    "messageCount": 3
  }
}
```

---

## Troubleshooting

### Deployment Fails

```bash
# Check app logs
doctl apps logs <APP_ID> --follow

# Common issues:
# - Missing CLAUDE_CODE_OAUTH_TOKEN
# - GitHub repo not accessible
# - Dockerfile build error
```

### Agent Returns 500 Error

```bash
# Check container logs
docker logs research-agent

# Or for App Platform
doctl apps logs <APP_ID> --type RUN

# Common causes:
# - Invalid CLAUDE_CODE_OAUTH_TOKEN
# - MCP server installation failed
# - Network timeout
```

### Health Check Fails

```bash
# Verify port is exposed
docker ps | grep research-agent

# Check if service is listening
curl -v http://localhost:8080/health

# Verify Dockerfile EXPOSE and CMD
cat Dockerfile | grep -E "EXPOSE|CMD"
```

---

## Next Steps After Deployment

1. **Update subagent hooks** to use production URL
2. **Deploy Task Master Agent** (clone and modify)
3. **Deploy Playwright Agent** (clone and modify)
4. **Configure private VPC** for all three agents
5. **Test end-to-end** from Claude Code CLI

---

## Cost Estimate

**App Platform (basic-xxs)**:
- 1 vCPU, 512 MB RAM
- ~$5-7/month per agent
- 3 agents = ~$15-21/month

**Droplet Alternative**:
- s-1vcpu-1gb droplet = $6/month
- Can run all 3 agents on 1 droplet
- Total = ~$6-12/month

**Container Registry**:
- Free tier: 500 MB storage
- Sufficient for 3 small images

---

## Resources

- **App Platform Docs**: https://docs.digitalocean.com/products/app-platform/
- **Container Registry**: https://docs.digitalocean.com/products/container-registry/
- **doctl CLI**: https://docs.digitalocean.com/reference/doctl/

**Ready to deploy!** 🚀
