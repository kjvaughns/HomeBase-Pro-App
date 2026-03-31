#!/bin/bash
# API verification script for HomeBase production endpoints
# Usage: ./scripts/verify-api.sh [API_URL]
# Example: ./scripts/verify-api.sh https://api.homebaseproapp.com

API_URL="${1:-https://api.homebaseproapp.com}"
echo "=== HomeBase API Verification ==="
echo "Target: $API_URL"
echo ""

# Test 1: Unauthenticated /me should return 401
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/auth/me")
if [ "$UNAUTH_STATUS" = "401" ]; then
  echo "[PASS] GET /api/auth/me (unauth) => 401"
else
  echo "[FAIL] GET /api/auth/me => $UNAUTH_STATUS (expected 401)"
fi

# Test 2: Health check
HEALTH=$(curl -s "$API_URL/api/health" 2>/dev/null || echo '{"status":"unknown"}')
echo "[INFO] GET /api/health => $HEALTH"

echo ""
echo "Done."
