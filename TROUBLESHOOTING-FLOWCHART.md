# Research Agent MVP - Visual Troubleshooting Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                    START: Query Returns 503                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Access DigitalOcean Logs                           │
│  https://cloud.digitalocean.com/apps/[APP-ID]/logs          │
│                                                              │
│  Search for (in order):                                     │
│  • "503"                    • "error"                       │
│  • "UnhandledPromiseRejection"  • "TypeError"              │
│  • "ANTHROPIC_API_KEY"      • "ECONNREFUSED"               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Found Error Message?  │
              └────────┬───────────┬───┘
                       │ YES       │ NO
                       │           │
         ┌─────────────▼─────┐     │
         │  Go to Error      │     │
         │  Pattern Analysis │     │
         │  (See below)      │     │
         └─────────────┬─────┘     │
                       │           │
                       │           ▼
                       │    ┌──────────────────────────┐
                       │    │ No Error Logs Visible    │
                       │    │                          │
                       │    │ LIKELY CAUSE:            │
                       │    │ Unhandled exception      │
                       │    │ (crashes before logging) │
                       │    │                          │
                       │    │ → Go to FIX #1           │
                       │    └──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    ERROR PATTERN ANALYSIS                     │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ERROR: "UnhandledPromiseRejection" or "TypeError"           │
│                                                             │
│ MEANING: Unhandled exception in query handler              │
│ CONFIDENCE: 80%                                            │
│ ACTION: → FIX #1 (Add Error Handlers)                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ERROR: "ANTHROPIC_API_KEY is not defined" or "401"         │
│                                                             │
│ MEANING: API key missing or invalid                        │
│ CONFIDENCE: 95%                                            │
│ ACTION: → FIX #2 (Check Environment Variables)            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ERROR: "ECONNREFUSED" or "ENOTFOUND" + "MCP"               │
│                                                             │
│ MEANING: Cannot connect to MCP gateway                     │
│ CONFIDENCE: 90%                                            │
│ ACTION: → FIX #3 (Test Gateway Health)                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ERROR: "JavaScript heap out of memory" or "exit code 137"  │
│                                                             │
│ MEANING: Out of memory (OOM)                               │
│ CONFIDENCE: 95%                                            │
│ ACTION: → FIX #4 (Upgrade Instance Size)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ERROR: "timeout" or "ETIMEDOUT" or "Load balancer timeout" │
│                                                             │
│ MEANING: Request exceeds 60 seconds                        │
│ CONFIDENCE: 85%                                            │
│ ACTION: → FIX #5 (Add Timeouts + Streaming)               │
└─────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│                            FIXES                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX #1: Add Error Handlers (Most Common)                    │
│                                                             │
│ Edit src/server.ts:                                        │
│                                                             │
│ // Process-level handlers                                  │
│ process.on('unhandledRejection', (reason, promise) => {   │
│   console.error('Unhandled Rejection:', reason);          │
│ });                                                        │
│                                                             │
│ process.on('uncaughtException', (error) => {              │
│   console.error('Uncaught Exception:', error);            │
│ });                                                        │
│                                                             │
│ // Endpoint-level handler                                  │
│ app.post('/api/query', async (req, res) => {              │
│   try {                                                    │
│     const result = await agent.run(req.body.query);       │
│     res.json(result);                                      │
│   } catch (error) {                                        │
│     console.error('Query error:', error);                 │
│     res.status(500).json({ error: error.message });      │
│   }                                                        │
│ });                                                        │
│                                                             │
│ Then:                                                       │
│ git add . && git commit -m "fix: add error handlers"      │
│ git push origin main                                        │
│ (Auto-deploys in ~2 minutes)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX #2: Check Environment Variables                         │
│                                                             │
│ 1. Go to DO console:                                       │
│    https://cloud.digitalocean.com/apps/[APP-ID]/settings  │
│                                                             │
│ 2. Click "Environment Variables"                           │
│                                                             │
│ 3. Verify these exist and are encrypted:                  │
│    • ANTHROPIC_API_KEY                                     │
│    • CONTEXT7_API_KEY                                      │
│    • MCP_SHARED_SECRET                                     │
│                                                             │
│ 4. If missing: Add → Save → Redeploy                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX #3: Test Gateway Health                                 │
│                                                             │
│ curl https://mcp-infrastructure-rhvlk.ondigitalocean.app/health │
│                                                             │
│ If returns 200:                                            │
│   → Gateway is healthy, issue in research agent           │
│   → Check MCP_SHARED_SECRET env var                       │
│                                                             │
│ If not 200:                                                │
│   → Gateway is down or unhealthy                          │
│   → Fix gateway first before continuing                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX #4: Upgrade Instance Size                               │
│                                                             │
│ Current: basic-xs (1 GB RAM)                               │
│ Upgrade to: basic-s (2 GB RAM)                            │
│                                                             │
│ Via DigitalOcean Specialist:                               │
│ Use mcp__digitalocean__apps-update with:                  │
│   instance_size_slug: "basic-s"                           │
│                                                             │
│ Or manually in DO console:                                 │
│   App → Settings → Edit Spec → Change instance size       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX #5: Add Timeouts + Streaming                            │
│                                                             │
│ Add to agent calls:                                        │
│                                                             │
│ const controller = new AbortController();                 │
│ const timeout = setTimeout(() => controller.abort(), 45000);│
│                                                             │
│ const response = await fetch(url, {                        │
│   signal: controller.signal,                              │
│   ...options                                               │
│ });                                                        │
│                                                             │
│ clearTimeout(timeout);                                     │
│                                                             │
│ Consider streaming responses to prevent buffering          │
└─────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│                      VERIFICATION STEPS                       │
└──────────────────────────────────────────────────────────────┘

After applying fix:

┌─────────────────────────────────────────────────────────────┐
│ 1. Wait for deployment to complete (~2 minutes)            │
│    Monitor in DO console                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Run diagnostic script:                                   │
│    ./test-research-agent.sh                                │
│                                                             │
│    Should see:                                             │
│    ✓ PASS - Health endpoint responding                    │
│    ✓ PASS - MCP Gateway healthy                           │
│    ✓ PASS - Simple query succeeded                        │
│    ✓ PASS - Research query succeeded                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check logs for errors:                                  │
│    doctl apps logs [APP-ID] --type RUN --tail 100         │
│                                                             │
│    Should NOT see:                                         │
│    • 503 errors                                            │
│    • Unhandled exceptions                                  │
│    • Process crashes                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Test manually:                                           │
│    curl -X POST [URL]/api/query \                          │
│      -H "Content-Type: application/json" \                 │
│      -d '{"query":"Test","max_tokens":100}'                │
│                                                             │
│    Should return 200 with valid JSON response              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │   SUCCESS!     │
                  │                │
                  │ All tests pass │
                  │ No 503 errors  │
                  └────────────────┘


┌──────────────────────────────────────────────────────────────┐
│                    QUICK COMMAND REFERENCE                    │
└──────────────────────────────────────────────────────────────┘

Access logs (web):
  https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs

Watch logs (CLI):
  doctl apps logs e13e1c19-b542-422d-8c21-40c45b3bb982 --type RUN --follow

Test health:
  curl -v https://research-agent-mvp-w8c42.ondigitalocean.app/health

Test query:
  curl -X POST https://research-agent-mvp-w8c42.ondigitalocean.app/api/query \
    -H "Content-Type: application/json" \
    -d '{"query":"Test","max_tokens":100}' \
    -v

Run full diagnostics:
  ./test-research-agent.sh


┌──────────────────────────────────────────────────────────────┐
│                   PRIORITY FIX ORDER                          │
└──────────────────────────────────────────────────────────────┘

1. FIX #1 - Add Error Handlers          (80% likely, always do this first)
2. FIX #3 - Test Gateway Health         (15% likely, quick to verify)
3. FIX #2 - Check Environment Variables (3% likely, easy to check)
4. FIX #4 - Upgrade Instance Size       (1% likely, only if OOM confirmed)
5. FIX #5 - Add Timeouts                (1% likely, only if timeout confirmed)


┌──────────────────────────────────────────────────────────────┐
│                         CONTACT                               │
└──────────────────────────────────────────────────────────────┘

App Owner: charlie@seismicmvmt.com
App ID: e13e1c19-b542-422d-8c21-40c45b3bb982
App URL: https://research-agent-mvp-w8c42.ondigitalocean.app
Documentation: See TROUBLESHOOTING-PLAYBOOK.md for complete details

```

---

**Remember**: Start with FIX #1 (error handlers) - it's the most likely cause and takes 5 minutes to implement.
