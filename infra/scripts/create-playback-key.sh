#!/usr/bin/env bash
# Creates the RSA key pair that signs playback URLs.
#   - private key -> SSM Parameter Store (encrypted SecureString). Never written to the repo.
#   - public key  -> infra/keys/playback-public-key.pem, committed; CloudFront verifies with it.
# Run once per environment. Re-running does nothing unless --rotate is passed.
set -euo pipefail

PROFILE="${AWS_PROFILE:-cvp-dev}"
PREFIX="${PREFIX:-cvp-dev}"
PARAMETER="/$PREFIX/playback/private-key"
PUBLIC_KEY="$(cd "$(dirname "$0")/.." && pwd)/keys/playback-public-key.pem"

exists=$(aws ssm describe-parameters --profile "$PROFILE" \
  --parameter-filters "Key=Name,Values=$PARAMETER" --query 'length(Parameters)' --output text)
if [[ "$exists" != "0" && -f "$PUBLIC_KEY" && "${1:-}" != "--rotate" ]]; then
  echo "Playback key already exists ($PARAMETER). Pass --rotate to replace it."
  exit 0
fi

WORK_DIR=$(mktemp -d)
chmod 700 "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

openssl genrsa -out "$WORK_DIR/private.pem" 2048 2>/dev/null
openssl rsa -pubout -in "$WORK_DIR/private.pem" -out "$PUBLIC_KEY" 2>/dev/null

aws ssm put-parameter --profile "$PROFILE" --name "$PARAMETER" --type SecureString \
  --value "file://$WORK_DIR/private.pem" --overwrite \
  --description "Signs CloudFront playback URLs" >/dev/null

echo "Private key stored in SSM: $PARAMETER"
echo "Public key written to:     $PUBLIC_KEY (commit it, then deploy)"
