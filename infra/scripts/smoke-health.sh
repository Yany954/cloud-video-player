#!/usr/bin/env bash
# End-to-end check: Cognito sign-in -> API Gateway JWT authorizer -> /health Lambda.
# Prompts for credentials (hidden) and never prints tokens. Handles the first-login
# "choose a new password" challenge for invited users.
set -euo pipefail

PROFILE="${AWS_PROFILE:-cvp-dev}"
PREFIX="${PREFIX:-cvp-dev}"

output() {
  aws cloudformation describe-stacks --profile "$PROFILE" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

POOL_ID=$(output "$PREFIX-auth" UserPoolId)
CLIENT_ID=$(output "$PREFIX-auth" AppClientId)
API_URL=$(output "$PREFIX-api" ApiUrl)

# Passwords go through a private temp file (mode 600, deleted on exit), so they never
# appear in shell history or `ps`. The AWS CLI on macOS can't read file:///dev/stdin.
INPUT_FILE=$(mktemp)
chmod 600 "$INPUT_FILE"
trap 'rm -f "$INPUT_FILE"' EXIT

cognito() {
  local command=$1
  shift
  jq -n "$@" >"$INPUT_FILE"
  aws cognito-idp "$command" --profile "$PROFILE" --cli-input-json "file://$INPUT_FILE"
  : >"$INPUT_FILE"
}

read -r -p "Email: " EMAIL
read -r -s -p "Password: " PASSWORD
echo

RESPONSE=$(cognito admin-initiate-auth \
  --arg pool "$POOL_ID" --arg client "$CLIENT_ID" --arg user "$EMAIL" --arg pass "$PASSWORD" \
  '{UserPoolId: $pool, ClientId: $client, AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
    AuthParameters: {USERNAME: $user, PASSWORD: $pass}}')

if [[ $(jq -r '.ChallengeName // empty' <<<"$RESPONSE") == "NEW_PASSWORD_REQUIRED" ]]; then
  echo "First sign-in: choose your permanent password (min 12 characters)."
  while true; do
    read -r -s -p "New password: " NEW_PASSWORD
    echo
    read -r -s -p "Repeat new password: " CONFIRM
    echo
    if ((${#NEW_PASSWORD} < 12)); then
      echo "Too short (${#NEW_PASSWORD} characters). Use at least 12."
    elif [[ "$NEW_PASSWORD" != "$CONFIRM" ]]; then
      echo "Passwords don't match. Try again."
    else
      break
    fi
  done
  RESPONSE=$(cognito admin-respond-to-auth-challenge \
    --arg pool "$POOL_ID" --arg client "$CLIENT_ID" --arg user "$EMAIL" --arg pass "$NEW_PASSWORD" \
    --arg session "$(jq -r '.Session' <<<"$RESPONSE")" \
    '{UserPoolId: $pool, ClientId: $client, ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: $session, ChallengeResponses: {USERNAME: $user, NEW_PASSWORD: $pass}}')
fi

ACCESS_TOKEN=$(jq -r '.AuthenticationResult.AccessToken // empty' <<<"$RESPONSE")
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "Sign-in did not return a token (challenge: $(jq -r '.ChallengeName // "none"' <<<"$RESPONSE"))." >&2
  exit 1
fi
echo "Signed in."

echo
echo "1) GET /health without a token (expect 401):"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${API_URL}health"

echo "2) GET /health with your token (expect 200):"
curl -s -w "\n   HTTP %{http_code}\n" -H "Authorization: Bearer $ACCESS_TOKEN" "${API_URL}health" | sed 's/^/   /'
