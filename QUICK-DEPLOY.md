# Quick Deployment Guide - MCP Connection Fix

**Time**: 10 minutes | **Risk**: Low (easy rollback) | **Status**: READY

---

## TL;DR

Research agent can't reach MCP tools. Fix: update 3 files + add 2 env vars + redeploy.

---

## Step 1: Update Source Code (5 minutes)

### File 1: `src/server.ts` (Line 108)

```diff
  env: {
-   MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp'
+   MCP_SERVERS_URL: process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp',
+   MCP_SHARED_SECRET: process.env.MCP_SHARED_SECRET || ''
  }
```

### File 2: `src/mcp-proxy.ts` (Lines 13, 35)

```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
+ const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';

  // Later in file (line 35):
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
+   'X-MCP-Secret': MCP_SHARED_SECRET
  },
```

### File 3: `src/mcp-client.ts` (Lines 10, 37, 132)

```diff
- const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';
+ const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp';
+ const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET || '';

  // Line 37 AND Line 132 (in two places):
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
+   'X-MCP-Secret': MCP_SHARED_SECRET
  }
```

### Commit and Push

```bash
cd /path/to/research-agent-mvp

git add src/server.ts src/mcp-proxy.ts src/mcp-client.ts
git commit -m "fix: update MCP gateway URL and add authentication"
git push origin main
```

---

## Step 2: Update DigitalOcean App (3 minutes)

### Option A: Via Claude Code (Recommended)

```typescript
mcp__digitalocean__apps-update({
  update: {
    app_id: "e13e1c19-b542-422d-8c21-40c45b3bb982",
    request: {
      spec: {
        name: "research-agent-mvp",
        services: [{
          name: "research-agent",
          git: {
            repo_clone_url: "https://github.com/cfisher8565/research-agent-mvp.git",
            branch: "main"
          },
          dockerfile_path: "Dockerfile",
          envs: [
            {
              key: "ANTHROPIC_API_KEY",
              value: "EV[1:8hx9HcyGJcwxJ5Mv/Z5bWMDcLMeMSE8v:sg/1Q1mAeE8v44pgiMuVifrtrzDiL5vEvxAMqoRuSsW0xBx2w1WaAcVQ9KMn25jypM2OL9f+ZMnCORSdHuIN3VefMiS1oxmLuyoZnntvfrEj0P/odMuHc3C0GF3hS93kl/u+QLgguSc239BeYIbDZ/hDFSqC7R6eunJS1w==]",
              scope: "RUN_TIME",
              type: "SECRET"
            },
            {
              key: "MCP_SERVERS_URL",
              value: "https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp",
              scope: "RUN_TIME"
            },
            {
              key: "MCP_SHARED_SECRET",
              value: "o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=",
              scope: "RUN_TIME",
              type: "SECRET"
            },
            {
              key: "PORT",
              value: "8080",
              scope: "RUN_TIME"
            },
            {
              key: "NODE_ENV",
              value: "production",
              scope: "RUN_TIME"
            }
          ],
          instance_size_slug: "basic-xxs",
          instance_count: 1,
          http_port: 8080,
          health_check: {
            initial_delay_seconds: 10,
            period_seconds: 30,
            timeout_seconds: 3,
            success_threshold: 1,
            failure_threshold: 3,
            http_path: "/health"
          }
        }],
        region: "fra",
        ingress: {
          rules: [{
            match: { path: { prefix: "/" } },
            component: { name: "research-agent" }
          }]
        }
      }
    }
  }
})
```

### Option B: Via DigitalOcean Dashboard

1. Go to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
2. Click "Settings" tab
3. Under "Environment Variables", add:
   - `MCP_SERVERS_URL` = `https://mcp-infrastructure-rhvlk.ondigitalocean.app/mcp`
   - `MCP_SHARED_SECRET` = `o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs=` (mark as secret)
4. Click "Save" → This triggers automatic rebuild

---

## Step 3: Wait for Deployment (2 minutes)

Monitor: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/deployments

Expected:
- Build: ~30 seconds
- Deploy: ~60 seconds
- Total: ~2 minutes

---

## Step 4: Validate (30 seconds)

```bash
# Quick test
curl https://research-agent-mvp-w8c42.ondigitalocean.app/health

# Expected output:
# {
#   "status": "healthy",
#   "mcp": {
#     "success": true,
#     "toolCount": 10,
#     "tools": [...]
#   }
# }
```

**Success**: `toolCount: 10`
**Failure**: `toolCount: 0` or HTTP 503

---

## Rollback (if needed)

```bash
# Via dashboard:
# 1. Go to Deployments tab
# 2. Find last working deployment (d63cf0a2-e005-46c8-bede-624f47397b79)
# 3. Click "..." → "Redeploy"
```

---

## Summary of Changes

**What changed**:
- 3 source files updated (URL + auth header)
- 2 environment variables added (MCP_SERVERS_URL, MCP_SHARED_SECRET)

**What didn't change**:
- All existing functionality preserved
- No breaking changes
- Same Docker setup
- Same health check configuration

**Risk level**: LOW - Easy to rollback, no data loss possible

---

**Full Details**: See `MCP-CONNECTION-PLAN.md` for complete documentation.
