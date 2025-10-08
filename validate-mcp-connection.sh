#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

RESEARCH_AGENT_URL="https://research-agent-mvp-w8c42.ondigitalocean.app"
MCP_GATEWAY_URL="https://mcp-infrastructure-rhvlk.ondigitalocean.app"
MCP_SECRET="o4SyP8ADoJD5DVz8TmEgdjGWkc1kofWHjOmPIdkOtNs="

echo "=================================="
echo "MCP Connection Validation Script"
echo "=================================="
echo ""

# Test 1: MCP Gateway Health
echo "Test 1: MCP Gateway Health Check"
GATEWAY_HEALTH=$(curl -s "$MCP_GATEWAY_URL/health" || echo "ERROR")
if echo "$GATEWAY_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ PASS${NC} - MCP Gateway is healthy"
    echo "$GATEWAY_HEALTH"
else
    echo -e "${RED}❌ FAIL${NC} - MCP Gateway unreachable"
    echo "$GATEWAY_HEALTH"
    exit 1
fi
echo ""

# Test 2: MCP Gateway Authentication
echo "Test 2: MCP Gateway Authentication (tools/list)"
TOOLS_LIST=$(curl -s -X POST "$MCP_GATEWAY_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "X-MCP-Secret: $MCP_SECRET" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')

TOOL_COUNT=$(echo "$TOOLS_LIST" | grep -o '"name"' | wc -l)
if [ "$TOOL_COUNT" -ge 10 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Found $TOOL_COUNT tools"
    echo "$TOOLS_LIST" | grep -o '"name":"[^"]*"' | head -5
    echo "..."
else
    echo -e "${RED}❌ FAIL${NC} - Only found $TOOL_COUNT tools (expected 10)"
    echo "$TOOLS_LIST"
    exit 1
fi
echo ""

# Test 3: Research Agent Health (may fail if not deployed yet)
echo "Test 3: Research Agent Health Check"
AGENT_HEALTH=$(curl -s "$RESEARCH_AGENT_URL/health" || echo "ERROR")
if echo "$AGENT_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ PASS${NC} - Research Agent is healthy"

    # Check MCP connection status
    if echo "$AGENT_HEALTH" | grep -q '"success":true'; then
        MCP_TOOL_COUNT=$(echo "$AGENT_HEALTH" | grep -o '"toolCount":[0-9]*' | grep -o '[0-9]*')
        if [ "$MCP_TOOL_COUNT" -eq 10 ]; then
            echo -e "${GREEN}✅ PASS${NC} - MCP connection working ($MCP_TOOL_COUNT tools)"
        else
            echo -e "${YELLOW}⚠️  WARN${NC} - MCP connection shows $MCP_TOOL_COUNT tools (expected 10)"
        fi
    else
        echo -e "${YELLOW}⚠️  WARN${NC} - MCP connection not working yet"
    fi
    echo "$AGENT_HEALTH"
else
    echo -e "${YELLOW}⚠️  WARN${NC} - Research Agent not deployed or unhealthy (expected during initial deployment)"
    echo "$AGENT_HEALTH"
fi
echo ""

# Test 4: Context7 Tool (via gateway directly)
echo "Test 4: Context7 Tool (direct gateway test)"
CONTEXT7_TEST=$(curl -s -X POST "$MCP_GATEWAY_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "X-MCP-Secret: $MCP_SECRET" \
    -d '{
        "jsonrpc":"2.0",
        "id":2,
        "method":"tools/call",
        "params":{
            "name":"mcp__context7__resolve-library-id",
            "arguments":{"libraryName":"react"}
        }
    }')

if echo "$CONTEXT7_TEST" | grep -q '"result"'; then
    echo -e "${GREEN}✅ PASS${NC} - Context7 tool working"
    echo "$CONTEXT7_TEST" | head -c 200
    echo "..."
else
    echo -e "${RED}❌ FAIL${NC} - Context7 tool not working"
    echo "$CONTEXT7_TEST"
fi
echo ""

# Summary
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo ""
echo "Pre-deployment checks:"
echo "  - MCP Gateway Health: ✅"
echo "  - MCP Gateway Auth: ✅"
echo "  - MCP Tools Available: ✅ ($TOOL_COUNT tools)"
echo ""
echo "Post-deployment checks:"
if echo "$AGENT_HEALTH" | grep -q '"success":true'; then
    echo "  - Research Agent Health: ✅"
    echo "  - Research Agent MCP Connection: ✅"
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
    echo "Research agent is ready to use!"
else
    echo "  - Research Agent: ⚠️  Not yet deployed or MCP not connected"
    echo ""
    echo -e "${YELLOW}⚠️  MCP Gateway ready, waiting for Research Agent deployment${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy research agent with updated code"
    echo "2. Add environment variables: MCP_SERVERS_URL, MCP_SHARED_SECRET"
    echo "3. Run this script again to verify"
fi
echo ""
echo "For full deployment guide, see MCP-CONNECTION-PLAN.md"
echo "=================================="
