# Research Agent MVP - Diagnostic Documentation Summary

Created: 2025-10-08  
For: research-agent-mvp troubleshooting

---

## Documents Created

### 1. TROUBLESHOOTING-PLAYBOOK.md (Comprehensive)

**Purpose**: Complete troubleshooting guide with all details

**Sections**:
- Quick Status Check (current config validation)
- Accessing DigitalOcean Logs (web + CLI)
- Error Pattern Recognition (6 categories with search terms)
- Diagnostic Testing Suite (automated + manual)
- Root Cause Analysis (5 hypotheses ranked)
- Alternative Diagnostic Approaches (7 methods)
- Recommended Next Steps (immediate, short-term, long-term)

**When to Use**: Deep investigation, documenting issues, training

---

### 2. QUICK-TROUBLESHOOTING.md (Reference Card)

**Purpose**: Fast lookup for common issues

**Sections**:
- App Info (IDs, URLs, instance details)
- Immediate Actions (3 steps to start)
- Most Likely Root Causes (ranked with fixes)
- Error Log Patterns (search terms table)
- CLI Commands (copy/paste ready)
- Decision Tree (visual troubleshooting)
- Quick Fixes (in priority order)

**When to Use**: Production incident, quick diagnosis, checklists

---

### 3. test-research-agent.sh (Executable Script)

**Purpose**: Automated testing suite

**Tests**:
1. Health endpoint check
2. MCP Gateway health
3. Simple query (minimal load)
4. Research query (with MCP tools)

**Output**: Timestamped log file with pass/fail results

**When to Use**: Before/after fixes, regression testing, CI/CD

---

## Quick Start Guide

### Scenario 1: Query Endpoint Just Failed

1. **Access logs immediately**:
   - Go to: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
   - Search for: `503`, `error`, `UnhandledPromiseRejection`

2. **Run diagnostic script**:
   ```bash
   ./test-research-agent.sh
   ```

3. **Check QUICK-TROUBLESHOOTING.md** for matching error pattern

---

### Scenario 2: Need to Debug Thoroughly

1. **Read TROUBLESHOOTING-PLAYBOOK.md** sections:
   - Error Pattern Recognition (identify issue)
   - Root Cause Analysis (understand problem)
   - Alternative Diagnostic Approaches (try different methods)

2. **Run tests while watching logs**:
   ```bash
   # Terminal 1
   doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

   # Terminal 2
   ./test-research-agent.sh
   ```

3. **Follow recommended next steps** from playbook

---

### Scenario 3: Want to Add Monitoring

See TROUBLESHOOTING-PLAYBOOK.md → Alternative Diagnostic Approaches:
- Add diagnostics endpoint (#2)
- Enable debug logging (#1)
- Monitor real-time metrics (#4)

---

## Key Insights from Investigation

### Current State (Validated via DigitalOcean API)

**Health**: ACTIVE and HEALTHY
- CPU: 3.24% (very low, normal)
- Memory: 7.23% (72 MB / 1024 MB, plenty free)
- Health checks passing every 60s

**Configuration**: All correct
- Instance: basic-xs (1 GB RAM, sufficient for now)
- Environment variables: All present and encrypted
- MCP URLs: Public gateway (not internal DNS)
- Health check: Relaxed timings (30s initial, 60s period)

**Deployment**: Latest
- Commit: 4d78c2884dc288329a6d03bd668644f9919498be
- Native HTTP MCP implementation
- No build errors

---

### Problem Pattern Analysis

**Symptoms**:
- Health endpoint: Works perfectly
- Query endpoint: Crashes with 503 connection_termination
- No specific errors visible (need DO logs to confirm)

**Strong Indicators This is NOT**:
- Memory issue (only using 7% of available)
- Resource exhaustion (CPU very low)
- Health check misconfiguration (passing consistently)
- Build issue (deployment successful)
- Environment variable issue (all present)

**Strong Indicators This IS**:
- Unhandled exception during query processing (most likely)
- Process crash without proper error handling
- Issue only triggered by query endpoint, not health endpoint

**Reasoning**:
1. App starts successfully (health works)
2. App doesn't crash under normal load (HEALTHY status)
3. App crashes ONLY when query endpoint called
4. No memory/CPU constraints
5. Pattern matches: query handler missing try/catch → unhandled exception → process exit → 503

---

### Most Likely Fix (80% Confidence)

Add comprehensive error handling to query endpoint:

```typescript
// src/server.ts

// Process-level handlers (prevent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately
});

// Endpoint-level handler (graceful errors)
app.post('/api/query', async (req, res) => {
  try {
    console.log('Query request:', req.body);

    const result = await agent.run(req.body.query);

    console.log('Query success');
    res.json(result);
  } catch (error) {
    console.error('Query error:', error);

    res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
```

**Why This Fixes It**:
- Catches exceptions at query handler level
- Prevents process crash from unhandled rejections
- Returns 500 with error details instead of 503 crash
- Logs full error for debugging

---

## Log Analysis Strategy

### Phase 1: Identify Error Type (5 minutes)

Search DO logs for these patterns (in order):

1. `UnhandledPromiseRejection` → Missing try/catch
2. `TypeError: Cannot read property` → SDK initialization error
3. `ANTHROPIC_API_KEY is not defined` → Env var issue
4. `ECONNREFUSED` → MCP gateway connection failure
5. `out of memory` → OOM (unlikely given 7% usage)
6. `timeout` → Request timeout (unlikely given fast health check)

**First match = root cause direction**

---

### Phase 2: Understand Context (10 minutes)

For matched error pattern, find:
- Timestamp of crash
- Full stack trace
- Request that triggered crash
- Memory/CPU at time of crash (if available)

---

### Phase 3: Correlate with Metrics (5 minutes)

Check DO console metrics during crash time:
- Memory spike? → OOM
- CPU spike? → Infinite loop
- No spikes? → Synchronous crash (exception)

---

### Phase 4: Test Hypothesis (10 minutes)

Apply most likely fix → Deploy → Test with script → Verify in logs

---

## Next Session Checklist

### Before Starting

- [ ] Review QUICK-TROUBLESHOOTING.md
- [ ] Have DO console open to logs
- [ ] Have terminal ready for CLI commands
- [ ] Review current app status (via mcp__digitalocean__apps-get-info)

### During Investigation

- [ ] Access DO logs (web or CLI)
- [ ] Search for error patterns (see Error Pattern Recognition)
- [ ] Run diagnostic script: `./test-research-agent.sh`
- [ ] Watch logs while testing (doctl apps logs --follow)
- [ ] Identify matching error pattern
- [ ] Check TROUBLESHOOTING-PLAYBOOK.md for that pattern

### After Identifying Issue

- [ ] Apply recommended fix from playbook
- [ ] Test locally if possible
- [ ] Commit and push (auto-deploys)
- [ ] Monitor deployment (2-3 minutes)
- [ ] Re-run diagnostic script
- [ ] Verify success criteria met

### Success Criteria

- [ ] Health endpoint returns 200
- [ ] Simple query returns 200 (not 503)
- [ ] Research query returns 200
- [ ] No 503 errors in logs
- [ ] Memory stays <70% during queries
- [ ] Response time <30 seconds

---

## Tools Reference

### DigitalOcean CLI (doctl)

```bash
# Install
brew install doctl

# Authenticate
doctl auth init

# Get logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000 > logs.txt
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type BUILD

# Get app info
doctl apps get e13e1c19-b542-422d-8c21-40c45b3bb982
```

### Web Console

- **App Dashboard**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
- **Runtime Logs**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs
- **Metrics**: Click "Insights" tab in app dashboard

### Diagnostic Script

```bash
# Make executable (first time only)
chmod +x test-research-agent.sh

# Run tests
./test-research-agent.sh

# Output saved to diagnostic-[timestamp].log
```

---

## Escalation Path

### If Quick Fixes Don't Work

1. **Enable debug logging**:
   - Add `DEBUG=*` and `NODE_OPTIONS=--trace-warnings` to DO env vars
   - Redeploy
   - Capture verbose logs

2. **Add diagnostics endpoint**:
   - Create `/api/diagnostics` to expose internal state
   - Test MCP connectivity from within app
   - Check env vars are accessible

3. **Test with minimal config**:
   - Deploy version with ONLY Context7 (no Perplexity/BrightData)
   - If works: Gateway connection issue
   - If fails: Core agent code issue

4. **Upgrade resources**:
   - If memory shows spikes: Upgrade to basic-s (2 GB)
   - If CPU maxes out: Consider professional-xs (2 vCPU)

5. **Review SDK documentation**:
   - Check MCP SDK version compatibility
   - Verify Claude SDK usage patterns
   - Look for breaking changes in recent versions

---

## Contact Info

- **App**: research-agent-mvp
- **Owner**: charlie@seismicmvmt.com
- **Support**: DigitalOcean App Platform support
- **Docs**: See TROUBLESHOOTING-PLAYBOOK.md for complete details

---

**Remember**: Most 503 connection_termination errors are unhandled exceptions. Start with error handlers!
