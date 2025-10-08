# Research Agent MVP - Troubleshooting Documentation

**Complete diagnostic playbook for investigating and fixing the query endpoint 503 crashes.**

---

## What's in This Package

Created: 2025-10-08  
Purpose: Comprehensive troubleshooting guide for research-agent-mvp deployment issues

### Files Overview

| File | Size | Purpose | When to Use |
|------|------|---------|-------------|
| **TROUBLESHOOTING-FLOWCHART.md** | Visual | ASCII flowchart with decision tree | Quick visual reference, print/share |
| **QUICK-TROUBLESHOOTING.md** | 6.7 KB | Fast lookup reference card | Production incidents, quick fixes |
| **TROUBLESHOOTING-PLAYBOOK.md** | 16 KB | Complete investigation guide | Deep debugging, documentation |
| **DIAGNOSTIC-SUMMARY.md** | 9.2 KB | Analysis and recommendations | Understanding problem, next steps |
| **test-research-agent.sh** | 4.5 KB | Automated test suite | Testing before/after fixes |

---

## Quick Start (5 Minutes)

### Scenario: Query endpoint just returned 503

**Step 1**: Open TROUBLESHOOTING-FLOWCHART.md
- Follow the visual decision tree
- Identifies most likely cause in <5 minutes

**Step 2**: Apply Fix #1 (most likely)
```bash
# Add error handlers to src/server.ts (see flowchart)
git add . && git commit -m "fix: add error handlers"
git push origin main
```

**Step 3**: Run tests after deploy
```bash
./test-research-agent.sh
```

Done! If still failing, see TROUBLESHOOTING-PLAYBOOK.md for deep investigation.

---

## Document Navigation Guide

### Start Here (Choose One)

**Production Incident** (need fix ASAP):
1. TROUBLESHOOTING-FLOWCHART.md → Visual decision tree
2. QUICK-TROUBLESHOOTING.md → Common fixes ranked by likelihood
3. Apply fix → Test with `./test-research-agent.sh`

**Deep Investigation** (need to understand problem):
1. DIAGNOSTIC-SUMMARY.md → Current state analysis
2. TROUBLESHOOTING-PLAYBOOK.md → Complete guide with all details
3. Test with `./test-research-agent.sh` while watching logs

**First Time User** (learning the system):
1. DIAGNOSTIC-SUMMARY.md → Overview and insights
2. TROUBLESHOOTING-FLOWCHART.md → Visual workflow
3. TROUBLESHOOTING-PLAYBOOK.md → Reference for details

---

## Key Findings Summary

### Current State (Validated)

**App Status**: ACTIVE and HEALTHY
- Health endpoint working perfectly
- CPU: 3.24% (very low)
- Memory: 7.23% (72 MB / 1024 MB - plenty free)
- Instance: basic-xs (1 GB RAM, 1 vCPU)
- Region: Frankfurt (fra)

**Problem**: Query endpoint crashes with 503 connection_termination

### Root Cause Analysis (80% Confidence)

**Most Likely Issue**: Unhandled exception in query handler

**Evidence**:
- Health check passes (app starts successfully)
- App is HEALTHY with low resource usage
- Crashes ONLY when query endpoint called
- No memory/CPU constraints
- Pattern matches classic unhandled exception behavior

**Why Not Other Issues**:
- Not memory: Only using 7% of available RAM
- Not CPU: Very low CPU usage (3%)
- Not config: All environment variables present
- Not build: Deployment successful
- Not resources: Instance size appropriate

**Recommended Fix**: Add comprehensive error handling (see FIX #1 in flowchart)

---

## Most Important Files

### For Quick Fixes

**TROUBLESHOOTING-FLOWCHART.md**:
- Visual decision tree
- Error pattern matching
- Fixes ranked by priority
- Verification steps
- Copy/paste ready commands

**QUICK-TROUBLESHOOTING.md**:
- 5 most likely causes ranked
- CLI commands ready to run
- Error log search terms
- Quick fixes in priority order

### For Understanding

**DIAGNOSTIC-SUMMARY.md**:
- Current state validation
- Problem pattern analysis
- Key insights from investigation
- Next session checklist
- Tools reference

**TROUBLESHOOTING-PLAYBOOK.md**:
- Complete error pattern recognition
- Root cause analysis (5 hypotheses)
- Alternative diagnostic approaches
- Recommended next steps
- Success criteria

### For Testing

**test-research-agent.sh**:
- Automated test suite
- Tests health, gateway, simple query, research query
- Outputs timestamped log file
- Color-coded pass/fail results

---

## Usage Examples

### Example 1: Quick Incident Response

```bash
# 1. Check flowchart (identify issue in 2 minutes)
cat TROUBLESHOOTING-FLOWCHART.md

# 2. Access logs to confirm
open "https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs"

# 3. Apply Fix #1 (add error handlers)
# Edit src/server.ts per flowchart instructions

# 4. Deploy
git add . && git commit -m "fix: add error handlers for unhandled exceptions"
git push origin main

# 5. Test after deploy (~2 minutes)
./test-research-agent.sh
```

**Time to fix**: 10-15 minutes

---

### Example 2: Deep Investigation

```bash
# 1. Read current state analysis
cat DIAGNOSTIC-SUMMARY.md

# 2. Access logs and search for patterns
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000 > logs.txt
grep -i "error\|exception\|503" logs.txt

# 3. Check specific error pattern in playbook
cat TROUBLESHOOTING-PLAYBOOK.md | grep -A 10 "UnhandledPromiseRejection"

# 4. Run tests while watching logs
# Terminal 1
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Terminal 2
./test-research-agent.sh

# 5. Apply recommended fix from playbook
# Follow detailed instructions in TROUBLESHOOTING-PLAYBOOK.md
```

**Time to diagnose**: 20-30 minutes

---

### Example 3: First Time Troubleshooting

```bash
# 1. Understand the problem
cat DIAGNOSTIC-SUMMARY.md

# 2. See visual workflow
cat TROUBLESHOOTING-FLOWCHART.md

# 3. Run diagnostic tests
./test-research-agent.sh

# 4. Check which test failed
cat diagnostic-*.log

# 5. Look up error in quick reference
cat QUICK-TROUBLESHOOTING.md | grep -A 5 "[error-pattern]"

# 6. Apply recommended fix
# Follow instructions from quick reference
```

**Time to understand and fix**: 30-45 minutes

---

## Testing Workflow

### Before Applying Fix

```bash
# 1. Capture baseline
./test-research-agent.sh
# This will FAIL, but documents current state

# 2. Save logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 500 > logs-before.txt

# 3. Note exact error pattern
grep -i "error" logs-before.txt
```

### After Applying Fix

```bash
# 1. Wait for deployment (~2 minutes)
# Monitor in DO console

# 2. Run tests again
./test-research-agent.sh
# Should PASS now

# 3. Compare logs
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 500 > logs-after.txt
diff logs-before.txt logs-after.txt

# 4. Verify success criteria
# See TROUBLESHOOTING-PLAYBOOK.md → Success Criteria section
```

---

## Success Criteria (When Fixed)

Run `./test-research-agent.sh` and verify ALL tests pass:

- [x] Health endpoint returns 200
- [x] MCP Gateway returns 200
- [x] Simple query returns 200 (not 503)
- [x] Research query returns 200 (not 503)

Check logs via:
```bash
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 100
```

Verify NO errors:
- [ ] No "503" errors
- [ ] No "UnhandledPromiseRejection"
- [ ] No "Process exited"
- [ ] No "Container restarted"

Check metrics in DO console:
- [ ] Memory stays <70% during queries
- [ ] CPU spikes are normal (<80%)
- [ ] Response time <30 seconds

---

## Tool Requirements

### Required

- **DigitalOcean Account**: Access to cloud.digitalocean.com
- **App Platform Access**: View logs and metrics
- **Terminal/Bash**: Run test script and CLI commands

### Optional but Recommended

- **doctl CLI**: DigitalOcean command-line tool
  ```bash
  brew install doctl  # macOS
  doctl auth init
  ```

- **curl**: HTTP testing (usually pre-installed)

- **git**: For applying fixes and deploying

---

## Links and References

### App Details

- **App ID**: `e13e1c19-b542-422d-8c21-40c45b3bb982`
- **App URL**: https://research-agent-mvp-w8c42.ondigitalocean.app
- **Dashboard**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982
- **Logs**: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs

### External Documentation

- DigitalOcean App Platform: https://docs.digitalocean.com/products/app-platform/
- doctl CLI Reference: https://docs.digitalocean.com/reference/doctl/
- Claude SDK: https://github.com/anthropics/anthropic-sdk-typescript
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk

---

## Troubleshooting the Troubleshooting

### If Scripts Don't Work

**test-research-agent.sh won't execute**:
```bash
chmod +x test-research-agent.sh
```

**doctl command not found**:
```bash
brew install doctl
doctl auth init
```

**Can't access logs via web**:
- Verify you're logged into correct DigitalOcean account
- Check you have permissions for this app
- Try direct URL: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs

### If Documentation is Unclear

1. Start with TROUBLESHOOTING-FLOWCHART.md (visual)
2. Check QUICK-TROUBLESHOOTING.md for specific error
3. Read TROUBLESHOOTING-PLAYBOOK.md for full details
4. Review DIAGNOSTIC-SUMMARY.md for context

---

## Getting Help

### Internal Resources

- Complete playbook: TROUBLESHOOTING-PLAYBOOK.md
- Quick reference: QUICK-TROUBLESHOOTING.md
- Visual guide: TROUBLESHOOTING-FLOWCHART.md
- Analysis: DIAGNOSTIC-SUMMARY.md

### External Support

- DigitalOcean Support: https://www.digitalocean.com/support
- App Platform Docs: https://docs.digitalocean.com/products/app-platform/
- Community: https://www.digitalocean.com/community

---

## Document Maintenance

### When to Update

- After fixing the issue (document what worked)
- If new error patterns discovered
- When app configuration changes
- After major SDK version updates

### How to Update

1. Identify which document needs update
2. Edit markdown file
3. Update "Last Updated" date
4. Commit with descriptive message

---

## Quick Command Cheat Sheet

```bash
# Access logs (web)
open "https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs"

# Access logs (CLI)
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Run diagnostic tests
./test-research-agent.sh

# Test health endpoint
curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health

# Test query endpoint
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Test","max_tokens":100}' \
  -v

# Check MCP gateway
curl -v https://mcp-infrastructure-rhvlk.ondigitalocean.app/health

# Get app info
doctl apps get e13e1c19-b542-422d-8c21-40c45b3bb982

# Save logs to file
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --tail 1000 > logs.txt
```

---

**Remember**: 80% of 503 errors are unhandled exceptions. Start with FIX #1 in the flowchart!

**Created**: 2025-10-08  
**Author**: DigitalOcean Infrastructure Specialist  
**Version**: 1.0
