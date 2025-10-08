# Troubleshooting Documentation Index

**Complete navigation guide for research-agent-mvp diagnostic materials.**

Created: 2025-10-08  
Total Documents: 6 files  
Total Size: ~68 KB

---

## Start Here

**New to troubleshooting this app?**  
→ Read: **TROUBLESHOOTING-README.md** (overview and getting started)

**Production incident happening now?**  
→ Open: **TROUBLESHOOTING-FLOWCHART.md** (visual decision tree, 5-min diagnosis)

**Need quick fix for common error?**  
→ Check: **QUICK-TROUBLESHOOTING.md** (reference card with fixes ranked)

**Want to understand the problem deeply?**  
→ Study: **DIAGNOSTIC-SUMMARY.md** (analysis and insights)

**Need complete investigation guide?**  
→ Read: **TROUBLESHOOTING-PLAYBOOK.md** (comprehensive 16 KB guide)

**Ready to test?**  
→ Run: **./test-research-agent.sh** (automated test suite)

---

## File Reference Matrix

| File | Size | Read Time | Complexity | Use Case |
|------|------|-----------|------------|----------|
| TROUBLESHOOTING-README.md | 11 KB | 5 min | Low | First-time orientation |
| TROUBLESHOOTING-FLOWCHART.md | 21 KB | 3 min | Low | Visual quick reference |
| QUICK-TROUBLESHOOTING.md | 6.7 KB | 3 min | Low | Incident response |
| DIAGNOSTIC-SUMMARY.md | 9.2 KB | 7 min | Medium | Understanding problem |
| TROUBLESHOOTING-PLAYBOOK.md | 16 KB | 15 min | High | Deep investigation |
| test-research-agent.sh | 4.5 KB | 2 min | Low | Automated testing |

---

## Document Purposes

### TROUBLESHOOTING-README.md
**What it is**: Master overview and navigation guide  
**Contains**:
- File descriptions and when to use each
- Quick start for common scenarios
- Usage examples with commands
- Success criteria checklist
- Tool requirements
- Links and references

**Read this if**: You're new to these docs or need orientation

---

### TROUBLESHOOTING-FLOWCHART.md
**What it is**: Visual ASCII flowchart with decision tree  
**Contains**:
- Step-by-step troubleshooting flow
- Error pattern matching
- 5 prioritized fixes with code snippets
- Verification steps
- Quick command reference

**Read this if**: You want visual guidance or need to print/share

---

### QUICK-TROUBLESHOOTING.md
**What it is**: Fast lookup reference card  
**Contains**:
- App info (IDs, URLs, instance details)
- Immediate actions (3-step process)
- 5 most likely causes ranked by probability
- Error log search terms table
- CLI commands (copy/paste ready)
- Decision tree diagram
- Quick fixes in priority order

**Read this if**: Production incident or need fast diagnosis

---

### DIAGNOSTIC-SUMMARY.md
**What it is**: Analysis report with recommendations  
**Contains**:
- Current state validation
- Problem pattern analysis
- Key insights from investigation
- Log analysis strategy
- Next session checklist
- Tools reference
- Escalation path

**Read this if**: Want to understand WHY the problem exists

---

### TROUBLESHOOTING-PLAYBOOK.md
**What it is**: Complete investigation manual (16 KB)  
**Contains**:
- Current configuration validation
- Accessing DigitalOcean logs (web + CLI)
- Error pattern recognition (6 categories)
- Diagnostic testing suite
- Root cause analysis (5 hypotheses)
- Alternative diagnostic approaches (7 methods)
- Recommended next steps (immediate, short-term, long-term)
- Decision tree
- Success criteria

**Read this if**: Deep debugging session or documenting findings

---

### test-research-agent.sh
**What it is**: Executable bash script for automated testing  
**Contains**:
- Test 1: Health endpoint check
- Test 2: MCP Gateway health
- Test 3: Simple query (minimal load)
- Test 4: Research query (with MCP tools)
- Color-coded pass/fail output
- Timestamped log file generation

**Run this when**: Testing before/after fixes or automation

---

## Usage Scenarios

### Scenario 1: "Query endpoint just crashed with 503"

**Time available**: 10-15 minutes

```
1. Open: TROUBLESHOOTING-FLOWCHART.md
2. Follow visual decision tree
3. Identify error pattern in DO logs
4. Apply Fix #1 (most likely)
5. Deploy and test with: ./test-research-agent.sh
```

**Files used**: Flowchart + test script

---

### Scenario 2: "I want to understand the root cause"

**Time available**: 30-45 minutes

```
1. Read: DIAGNOSTIC-SUMMARY.md (problem analysis)
2. Read: TROUBLESHOOTING-PLAYBOOK.md (root cause section)
3. Access DO logs and search for patterns
4. Run: ./test-research-agent.sh while watching logs
5. Follow playbook recommendations
```

**Files used**: Summary + Playbook + test script

---

### Scenario 3: "First time troubleshooting this app"

**Time available**: 1 hour

```
1. Read: TROUBLESHOOTING-README.md (orientation)
2. Read: DIAGNOSTIC-SUMMARY.md (current state)
3. Review: TROUBLESHOOTING-FLOWCHART.md (visual workflow)
4. Study: QUICK-TROUBLESHOOTING.md (common patterns)
5. Run: ./test-research-agent.sh (baseline test)
6. Reference: TROUBLESHOOTING-PLAYBOOK.md (as needed)
```

**Files used**: All documents

---

### Scenario 4: "Need to share troubleshooting steps"

**Time available**: 5 minutes

```
1. Share: TROUBLESHOOTING-FLOWCHART.md (visual + complete)
2. Or share: QUICK-TROUBLESHOOTING.md (text-based reference)
3. Include: test-research-agent.sh (for testing)
```

**Files shared**: Flowchart or Quick Reference + script

---

## Content Overlap Matrix

Files share some content for redundancy, so you can start anywhere:

| Content Type | README | Flowchart | Quick | Summary | Playbook |
|--------------|--------|-----------|-------|---------|----------|
| App info (IDs, URLs) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Error patterns | Overview | Visual | Table | Analysis | Detailed |
| Fixes | Examples | Code | Ranked | Strategy | Complete |
| Commands | Selected | Essential | All | Key | All |
| Analysis | Summary | - | - | Deep | Deep |
| Testing | Guide | Steps | Commands | Strategy | Suite |

---

## Reading Paths

### Path 1: Minimum Viable Troubleshooting (5 minutes)
```
TROUBLESHOOTING-FLOWCHART.md
└─ Follow visual tree
   └─ Apply recommended fix
      └─ Run: ./test-research-agent.sh
```

### Path 2: Standard Troubleshooting (15 minutes)
```
QUICK-TROUBLESHOOTING.md
└─ Immediate Actions (3 steps)
   └─ Most Likely Causes (identify match)
      └─ Apply Quick Fix
         └─ Run: ./test-research-agent.sh
```

### Path 3: Complete Investigation (45 minutes)
```
TROUBLESHOOTING-README.md (orientation)
└─ DIAGNOSTIC-SUMMARY.md (understand problem)
   └─ TROUBLESHOOTING-PLAYBOOK.md (deep dive)
      └─ Access DO logs (search patterns)
         └─ Run: ./test-research-agent.sh (while watching logs)
            └─ Apply recommended fix from playbook
               └─ Verify success criteria
```

### Path 4: Learning Path (1-2 hours)
```
TROUBLESHOOTING-README.md (start)
└─ DIAGNOSTIC-SUMMARY.md (context)
   └─ TROUBLESHOOTING-FLOWCHART.md (visual)
      └─ QUICK-TROUBLESHOOTING.md (patterns)
         └─ TROUBLESHOOTING-PLAYBOOK.md (reference)
            └─ Run: ./test-research-agent.sh (practice)
```

---

## Key Insights Summary

**From all documents, the consensus is**:

1. **Most Likely Issue** (80%): Unhandled exception in query handler
   - Fix: Add process-level and endpoint-level error handlers

2. **Current State**: App is HEALTHY with low resource usage
   - Memory: 7.23% (72 MB / 1024 MB)
   - CPU: 3.24%
   - Health endpoint: Working perfectly

3. **NOT the Issue**:
   - Memory constraints
   - CPU bottleneck
   - Missing environment variables
   - Build failures

4. **Recommended Action**: Apply FIX #1 from flowchart first

---

## Quick Command Cheat Sheet

```bash
# Navigate docs
cat TROUBLESHOOTING-FLOWCHART.md    # Visual guide
cat QUICK-TROUBLESHOOTING.md        # Quick reference
cat TROUBLESHOOTING-PLAYBOOK.md     # Complete guide

# Access logs
open "https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs"
doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

# Run tests
./test-research-agent.sh

# Test endpoints
curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health
curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Test","max_tokens":100}' \
  -v
```

---

## File Dependencies

```
TROUBLESHOOTING-README.md (master overview)
│
├─→ TROUBLESHOOTING-FLOWCHART.md (references in "Quick Start")
├─→ QUICK-TROUBLESHOOTING.md (references in "Production Incident")
├─→ DIAGNOSTIC-SUMMARY.md (references in "Understanding")
├─→ TROUBLESHOOTING-PLAYBOOK.md (references in "Complete Guide")
└─→ test-research-agent.sh (references in "Testing")

All documents can be used independently (self-contained)
```

---

## Success Criteria (From All Docs)

Fixed when:
- [ ] Health endpoint returns 200
- [ ] Simple query returns 200 (not 503)
- [ ] Research query returns 200
- [ ] No 503 errors in logs
- [ ] No unhandled exceptions in logs
- [ ] Memory stays <70% during queries
- [ ] Response time <30 seconds

Test with: `./test-research-agent.sh`

---

## Next Steps

1. **If you haven't started**: Read TROUBLESHOOTING-README.md
2. **If incident is happening**: Open TROUBLESHOOTING-FLOWCHART.md
3. **If you need context**: Read DIAGNOSTIC-SUMMARY.md
4. **If you're investigating**: Use TROUBLESHOOTING-PLAYBOOK.md
5. **After any action**: Run ./test-research-agent.sh

---

## Document Maintenance

**When to update**:
- After fixing the issue (document what worked)
- If new error patterns discovered
- When app configuration changes

**How to update**:
1. Edit relevant markdown file
2. Update "Last Updated" date
3. Update this index if structure changes

---

## Contact

- App Owner: charlie@seismicmvmt.com
- App ID: e13e1c19-b542-422d-8c21-40c45b3bb982
- Created: 2025-10-08
- Author: DigitalOcean Infrastructure Specialist

---

**Remember**: Start with TROUBLESHOOTING-FLOWCHART.md for fastest diagnosis.
