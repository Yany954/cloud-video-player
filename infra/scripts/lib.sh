# Shared helpers for the smoke test scripts. Source it; don't run it.
# After sign_in, ACCESS_TOKEN holds a Cognito access token (never print it).

PROFILE="${AWS_PROFILE:-cvp-dev}"
PREFIX="${PREFIX:-cvp-dev}"

stack_output() {
  aws cloudformation describe-stacks --profile "$PROFILE" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

# Passwords go through a private temp file (mode 600, deleted on exit), so they never
# appear in shell history or `ps`. The AWS CLI on macOS can't read file:///dev/stdin.
INPUT_FILE=$(mktemp)
chmod 600 "$INPUT_FILE"

cognito() {
  local command=$1
  shift
  jq -n "$@" >"$INPUT_FILE"
  aws cognito-idp "$command" --profile "$PROFILE" --cli-input-json "file://$INPUT_FILE"
  : >"$INPUT_FILE"
}

# Prompts for credentials (hidden) and handles the first-login "choose a new password"
# challenge for invited users.
sign_in() {
  local pool_id client_id email password new_password confirm response
  pool_id=$(stack_output "$PREFIX-auth" UserPoolId)
  client_id=$(stack_output "$PREFIX-auth" AppClientId)

  read -r -p "Email: " email
  read -r -s -p "Password: " password
  echo

  response=$(cognito admin-initiate-auth \
    --arg pool "$pool_id" --arg client "$client_id" --arg user "$email" --arg pass "$password" \
    '{UserPoolId: $pool, ClientId: $client, AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: {USERNAME: $user, PASSWORD: $pass}}')

  if [[ $(jq -r '.ChallengeName // empty' <<<"$response") == "NEW_PASSWORD_REQUIRED" ]]; then
    echo "First sign-in: choose your permanent password (min 12 characters)."
    while true; do
      read -r -s -p "New password: " new_password
      echo
      read -r -s -p "Repeat new password: " confirm
      echo
      if ((${#new_password} < 12)); then
        echo "Too short (${#new_password} characters). Use at least 12."
      elif [[ "$new_password" != "$confirm" ]]; then
        echo "Passwords don't match. Try again."
      else
        break
      fi
    done
    response=$(cognito admin-respond-to-auth-challenge \
      --arg pool "$pool_id" --arg client "$client_id" --arg user "$email" \
      --arg pass "$new_password" --arg session "$(jq -r '.Session' <<<"$response")" \
      '{UserPoolId: $pool, ClientId: $client, ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: $session, ChallengeResponses: {USERNAME: $user, NEW_PASSWORD: $pass}}')
  fi

  ACCESS_TOKEN=$(jq -r '.AuthenticationResult.AccessToken // empty' <<<"$response")
  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "Sign-in did not return a token." >&2
    exit 1
  fi
  echo "Signed in."
}
