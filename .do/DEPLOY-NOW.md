# Deploy Research Agent to DigitalOcean NOW

**Quick 3-step deployment to Frankfurt, Germany**

---

## Prerequisites

You need your **ANTHROPIC_API_KEY**. Get it from:

1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy the key (format: `sk-ant-api03-...`)

---

## Step 1: Update Environment Variable

Edit `.do/app.yaml` and replace this line:

```yaml
value: "YOUR_ANTHROPIC_API_KEY_HERE"
```

With your actual API key:

```yaml
value: "sk-ant-api03-YOUR_ACTUAL_KEY"
```

---

## Step 2: Deploy to DigitalOcean

```bash
cd /Users/charliefisher/Desktop/seismic-core\(Tue\,\ Sept30\)/remote-agents/research-agent-mvp

# Deploy using doctl
doctl apps create --spec .do/app.yaml
```

This will:
- Create app in **Frankfurt, Germany** (fra region)
- Build from GitHub repo: https://github.com/cfisher8565/research-agent-mvp
- Deploy as internal service (no public routes)
- Auto-deploy on push to main branch

---

## Step 3: Monitor Deployment

```bash
# List your apps
doctl apps list

# Get the app ID from the output, then:
doctl apps get <APP_ID>

# Watch logs
doctl apps logs <APP_ID> --follow

# Check deployment status
doctl apps get-deployment <APP_ID>
```

---

## What Happens Next

1. **DigitalOcean** pulls from GitHub
2. **Builds** Docker image using Dockerfile
3. **Deploys** to Frankfurt region
4. **Health check** confirms it's running
5. **Internal URL** becomes available (e.g., `research-agent-mvp-xxx.ondigitalocean.app`)

---

## Testing After Deployment

```bash
# Get the internal URL from app details
AGENT_URL=$(doctl apps get <APP_ID> --format DefaultIngress --no-header)

# Health check
curl https://${AGENT_URL}/health

# Query test
curl -X POST https://${AGENT_URL}/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Research TanStack Query v5 mutations"}'
```

---

## Troubleshooting

### "Authentication required"

The app.yaml has `internal_ports` configured. If you need public access, change:

```yaml
# Remove this:
internal_ports:
  - 8080

# Add this:
routes:
  - path: /
```

### "Build failed"

Check logs:
```bash
doctl apps logs <APP_ID> --type BUILD
```

Common issues:
- Missing `package-lock.json` (we have it ✅)
- Invalid `tsconfig.json` (we have it ✅)
- Missing `src/server.ts` (we have it ✅)

### "CLAUDE_CODE_OAUTH_TOKEN not set"

Update the secret:
```bash
# Update via CLI
doctl apps update <APP_ID> --spec .do/app.yaml

# Or update via web console:
# DigitalOcean Console → Apps → research-agent-mvp → Settings → Environment Variables
```

---

## Cost

**Basic-XXS tier**:
- 512 MB RAM, 0.25 vCPU
- **$5/month** (~$0.007/hour)
- Free trial available for new accounts

---

## Next Steps

After successful deployment:
1. Update subagent hooks to use production URL
2. Deploy Task Master Agent (clone this repo)
3. Deploy Playwright Agent (clone this repo)
4. Configure private VPC for all 3 agents

**Ready to deploy!** 🚀🇩🇪
