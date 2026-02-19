#!/bin/sh
# Test API routes. Run with dev server up: npm run dev (or dev:safe), then sh scripts/test-api-routes.sh
# Usage: BASE=http://localhost:3030 sh scripts/test-api-routes.sh
set -e
BASE="${BASE:-http://localhost:3030}"

echo "=== 0. Status (env + DB check) ==="
curl -s "$BASE/api/status" | head -c 600
echo ""
echo ""

echo "=== 1. DB test (insert, read, delete one entity) ==="
curl -s "$BASE/api/db-test" | head -c 300
echo ""
echo ""

echo "=== 2. GET /api/entities (sorted by created_at desc) ==="
curl -s "$BASE/api/entities" | head -c 400
echo ""
echo ""

echo "=== 3. GET /api/entities/[id] (with people, outreach, pipeline) ==="
# Get first entity id if any
ID=$(curl -s "$BASE/api/entities" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$ID" ]; then
  curl -s "$BASE/api/entities/$ID" | head -c 500
else
  echo "(no entities yet, skip)"
fi
echo ""
echo ""

echo "=== 4. POST /api/research (creates entity + people + pipeline) ==="
echo "Run manually: curl -X POST $BASE/api/research -H 'Content-Type: application/json' -d '{\"name\":\"Test Co\",\"website\":\"https://example.com\"}'"
echo "Done."
