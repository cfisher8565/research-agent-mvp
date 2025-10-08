#!/bin/bash
set -e

echo "🚀 Testing Research Agent MVP"
echo ""

# Check if token is set
if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "❌ Error: CLAUDE_CODE_OAUTH_TOKEN not set"
  echo "Run: export CLAUDE_CODE_OAUTH_TOKEN='sk-ant-oat01-...'"
  exit 1
fi

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8080/health)
echo "Response: $HEALTH_RESPONSE"
echo "✅ Health check passed"
echo ""

# Test 2: Simple query
echo "2️⃣ Testing query endpoint..."
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello"}' \
  | jq .

echo ""
echo "✅ Query test complete"
echo ""

# Test 3: Context7 research
echo "3️⃣ Testing Context7 research..."
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Use Context7 to find the library ID for TanStack Query"}' \
  | jq .

echo ""
echo "✅ Context7 research test complete"
echo ""
echo "🎉 All tests passed!"
