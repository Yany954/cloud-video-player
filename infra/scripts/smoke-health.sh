#!/usr/bin/env bash
# End-to-end check: Cognito sign-in -> API Gateway JWT authorizer -> /health Lambda.
# Prompts for credentials (hidden) and never prints tokens.
set -euo pipefail

source "$(dirname "$0")/lib.sh"
trap 'rm -f "$INPUT_FILE"' EXIT

API_URL=$(stack_output "$PREFIX-api" ApiUrl)
sign_in

echo
echo "1) GET /health without a token (expect 401):"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${API_URL}health"

echo "2) GET /health with your token (expect 200):"
curl -s -w "\n   HTTP %{http_code}\n" -H "Authorization: Bearer $ACCESS_TOKEN" "${API_URL}health" | sed 's/^/   /'
