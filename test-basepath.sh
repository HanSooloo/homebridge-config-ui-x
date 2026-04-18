#!/bin/bash

# Test script for basePath feature
# This script tests various endpoints with and without basePath

BASE_URL="http://localhost:8581"
BASE_PATH="/homebridge"

echo "================================"
echo "Testing Homebridge UI basePath Feature"
echo "================================"
echo ""
echo "Configuration: basePath = '$BASE_PATH'"
echo "Server URL: $BASE_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name: $response_code (expected $expected_code)"
    else
        echo -e "${RED}✗${NC} $name: $response_code (expected $expected_code)"
    fi
}

test_content() {
    local name=$1
    local url=$2
    local search_string=$3
    local content=$(curl -s "$url")

    if echo "$content" | grep -q "$search_string"; then
        echo -e "${GREEN}✓${NC} $name: Found '$search_string'"
    else
        echo -e "${RED}✗${NC} $name: '$search_string' not found"
    fi
}

echo "Testing UI Endpoints:"
echo "--------------------"
test_endpoint "UI at basePath" "$BASE_URL$BASE_PATH/" "200"
test_content "Base href injection" "$BASE_URL$BASE_PATH/" "<base href=\"$BASE_PATH/\""

echo ""
echo "Testing API Endpoints:"
echo "--------------------"
test_endpoint "API at basePath" "$BASE_URL$BASE_PATH/api/status/homebridge-version" "401"
test_endpoint "Old API path (should be caught by SPA)" "$BASE_URL/api/status/homebridge-version" "200"

echo ""
echo "Testing WebSocket Endpoints:"
echo "--------------------"
test_content "Socket.io at basePath" "$BASE_URL$BASE_PATH/socket.io/?EIO=4&transport=polling" "\"sid\""
test_endpoint "Old socket.io path" "$BASE_URL/socket.io/?EIO=4&transport=polling" "200"

echo ""
echo "Testing Swagger Docs:"
echo "--------------------"
test_endpoint "Swagger at basePath" "$BASE_URL$BASE_PATH/swagger/" "200"
test_content "Swagger UI" "$BASE_URL$BASE_PATH/swagger/" "Swagger UI"

echo ""
echo "Testing Static Assets:"
echo "--------------------"
# Get an actual asset filename from the index.html
ASSET=$(curl -s "$BASE_URL$BASE_PATH/" | grep -oP 'href="\K[^"]*\.css' | head -1)
if [ -n "$ASSET" ]; then
    test_endpoint "Static asset at basePath" "$BASE_URL$BASE_PATH/$ASSET" "200"
    test_endpoint "Static asset at root" "$BASE_URL/$ASSET" "200"
else
    echo -e "${YELLOW}⚠${NC} Could not detect asset filename"
fi

echo ""
echo "================================"
echo "Testing Complete!"
echo "================================"
echo ""
echo "To manually test:"
echo "  1. Open browser to: $BASE_URL$BASE_PATH/"
echo "  2. Check that all assets load correctly"
echo "  3. Check browser console for any errors"
echo "  4. Verify API calls use basePath prefix"
