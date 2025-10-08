#!/bin/bash

# Research Agent MVP - Diagnostic Test Suite
# Tests health, query endpoint, and various failure modes

APP_URL="https://research-agent-mvp-w8c42.ondigitalocean.app"
GATEWAY_URL="https://mcp-infrastructure-rhvlk.ondigitalocean.app"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="diagnostic-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Research Agent MVP Diagnostic Test Suite ===" | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"
echo "App URL: $APP_URL" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 1: Health Check
echo "Test 1: Health Check" | tee -a "$LOG_FILE"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" "$APP_URL/health")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
HEALTH_TIME=$(echo "$HEALTH_RESPONSE" | grep "TIME_TOTAL" | cut -d':' -f2)

if [ "$HEALTH_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Health endpoint responding (${HEALTH_TIME}s)" | tee -a "$LOG_FILE"
    echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE\|TIME_TOTAL" | tee -a "$LOG_FILE"
else
    echo -e "${RED}✗ FAIL${NC} - Health endpoint returned $HEALTH_CODE" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 2: MCP Gateway Health
echo "Test 2: MCP Gateway Health" | tee -a "$LOG_FILE"
GATEWAY_HEALTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$GATEWAY_URL/health")
GATEWAY_CODE=$(echo "$GATEWAY_HEALTH" | grep "HTTP_CODE" | cut -d':' -f2)

if [ "$GATEWAY_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - MCP Gateway healthy" | tee -a "$LOG_FILE"
else
    echo -e "${RED}✗ FAIL${NC} - MCP Gateway returned $GATEWAY_CODE" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}WARNING: Research agent may fail if gateway is down${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 3: Simple Query (Minimal Load)
echo "Test 3: Simple Query (Minimal Load)" | tee -a "$LOG_FILE"
SIMPLE_QUERY='{"query":"What is 2+2?","max_tokens":100}'
echo "Payload: $SIMPLE_QUERY" | tee -a "$LOG_FILE"

SIMPLE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
    -X POST "$APP_URL/api/query" \
    -H "Content-Type: application/json" \
    -d "$SIMPLE_QUERY" \
    --max-time 120)

SIMPLE_CODE=$(echo "$SIMPLE_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
SIMPLE_TIME=$(echo "$SIMPLE_RESPONSE" | grep "TIME_TOTAL" | cut -d':' -f2)

if [ "$SIMPLE_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Simple query succeeded (${SIMPLE_TIME}s)" | tee -a "$LOG_FILE"
    echo "$SIMPLE_RESPONSE" | grep -v "HTTP_CODE\|TIME_TOTAL" | head -n 20 | tee -a "$LOG_FILE"
else
    echo -e "${RED}✗ FAIL${NC} - Simple query returned $SIMPLE_CODE" | tee -a "$LOG_FILE"
    echo "$SIMPLE_RESPONSE" | grep -v "HTTP_CODE\|TIME_TOTAL" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 4: Research Query (With MCP Tools)
echo "Test 4: Research Query (With MCP Tools)" | tee -a "$LOG_FILE"
RESEARCH_QUERY='{"query":"Search for latest information about TypeScript 5.8 features using Perplexity","max_tokens":500}'
echo "Payload: $RESEARCH_QUERY" | tee -a "$LOG_FILE"

RESEARCH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
    -X POST "$APP_URL/api/query" \
    -H "Content-Type: application/json" \
    -d "$RESEARCH_QUERY" \
    --max-time 120)

RESEARCH_CODE=$(echo "$RESEARCH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
RESEARCH_TIME=$(echo "$RESEARCH_RESPONSE" | grep "TIME_TOTAL" | cut -d':' -f2)

if [ "$RESEARCH_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Research query succeeded (${RESEARCH_TIME}s)" | tee -a "$LOG_FILE"
    echo "$RESEARCH_RESPONSE" | grep -v "HTTP_CODE\|TIME_TOTAL" | head -n 30 | tee -a "$LOG_FILE"
else
    echo -e "${RED}✗ FAIL${NC} - Research query returned $RESEARCH_CODE" | tee -a "$LOG_FILE"
    echo "$RESEARCH_RESPONSE" | grep -v "HTTP_CODE\|TIME_TOTAL" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "=== Test Summary ===" | tee -a "$LOG_FILE"
echo "Full log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Next Steps:" | tee -a "$LOG_FILE"
echo "1. Review failed tests above" | tee -a "$LOG_FILE"
echo "2. Check DigitalOcean logs: https://cloud.digitalocean.com/apps/e13e1c19-b542-422d-8c21-40c45b3bb982/logs" | tee -a "$LOG_FILE"
echo "3. Search logs for error patterns (see TROUBLESHOOTING-PLAYBOOK.md)" | tee -a "$LOG_FILE"
echo "4. Compare memory usage before/after failed query" | tee -a "$LOG_FILE"
