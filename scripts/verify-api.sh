#!/bin/bash
# HomeBase API verification script
# Usage: ./scripts/verify-api.sh [API_URL] [TEST_EMAIL] [TEST_PASSWORD]
# Example: ./scripts/verify-api.sh https://api.homebaseproapp.com test@example.com password123

API_URL="${1:-https://api.homebaseproapp.com}"
TEST_EMAIL="${2:-}"
TEST_PASSWORD="${3:-}"

echo "=== HomeBase API Verification ==="
echo "Target: $API_URL"
echo "Date:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

PASS=0
FAIL=0

# Test 1: Health check
HEALTH_RESP=$(curl -s --max-time 10 "$API_URL/api/health" 2>/dev/null)
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/api/health" 2>/dev/null)
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "[PASS] GET /api/health => 200 | $HEALTH_RESP"
  PASS=$((PASS + 1))
else
  echo "[FAIL] GET /api/health => $HEALTH_STATUS"
  FAIL=$((FAIL + 1))
fi

# Test 2: Unauthenticated /me should return 401
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/api/auth/me" 2>/dev/null)
if [ "$UNAUTH_STATUS" = "401" ]; then
  echo "[PASS] GET /api/auth/me (unauth) => 401"
  PASS=$((PASS + 1))
else
  echo "[FAIL] GET /api/auth/me (unauth) => $UNAUTH_STATUS (expected 401)"
  FAIL=$((FAIL + 1))
fi

# Test 3: Login (if credentials provided)
if [ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ]; then
  LOGIN_RESP=$(curl -s --max-time 10 -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$API_URL/api/auth/login" 2>/dev/null)
  LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$API_URL/api/auth/login" 2>/dev/null)
  HAS_TOKEN=$(echo "$LOGIN_RESP" | grep -c '"token"' 2>/dev/null || echo "0")
  if [ "$LOGIN_STATUS" = "200" ] && [ "$HAS_TOKEN" -gt "0" ]; then
    echo "[PASS] POST /api/auth/login => 200 | token present"
    PASS=$((PASS + 1))

    # Extract token for authenticated test
    TOKEN=$(echo "$LOGIN_RESP" | sed 's/.*"token":"\([^"]*\)".*/\1/' 2>/dev/null)
    if [ -n "$TOKEN" ]; then
      AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -H "Authorization: Bearer $TOKEN" \
        "$API_URL/api/auth/me" 2>/dev/null)
      if [ "$AUTH_STATUS" = "200" ]; then
        echo "[PASS] GET /api/auth/me (authenticated) => 200"
        PASS=$((PASS + 1))
      else
        echo "[FAIL] GET /api/auth/me (authenticated) => $AUTH_STATUS"
        FAIL=$((FAIL + 1))
      fi
    fi
  else
    echo "[FAIL] POST /api/auth/login => $LOGIN_STATUS | token=$(echo $HAS_TOKEN)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "[SKIP] POST /api/auth/login — provide TEST_EMAIL and TEST_PASSWORD to test"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq "0" ] && exit 0 || exit 1
