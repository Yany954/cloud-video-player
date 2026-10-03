#!/usr/bin/env bash
# End-to-end check of the upload API against real AWS: start, partial upload, resume,
# complete, quota accounting, rejections and abort. Uploads a 100 MB random file and
# removes everything it created when it exits, even on failure.
set -euo pipefail

source "$(dirname "$0")/lib.sh"

SIZE_BYTES=$((100 * 1024 * 1024))
WORK_DIR=$(mktemp -d)
FILE="$WORK_DIR/smoke-test.mp4"
FAILURES=0
VIDEO_ID=""
ABORTED_ID=""
COMPLETED=false
USER_ID=""

API_URL=$(stack_output "$PREFIX-api" ApiUrl)
BUCKET=$(stack_output "$PREFIX-storage" UploadsBucketName)
TABLE=$(stack_output "$PREFIX-data" TableName)

# Calls the API with the user's token. Sets STATUS and BODY.
api() {
  local method=$1 path=$2 data=${3:-} response
  local args=(-s -w '\n%{http_code}' -X "$method" -H "Authorization: Bearer $ACCESS_TOKEN")
  if [[ -n "$data" ]]; then args+=(-H 'content-type: application/json' --data "$data"); fi
  response=$(curl "${args[@]}" "${API_URL}${path}")
  STATUS=${response##*$'\n'}
  BODY=${response%$'\n'*}
}

check() {
  local description=$1 expected=$2 actual=$3
  if [[ "$expected" == "$actual" ]]; then
    echo "   ✓ $description"
  else
    echo "   ✗ $description (expected: $expected, got: $actual)"
    FAILURES=$((FAILURES + 1))
  fi
}

# PUTs one part of FILE straight to S3 through its presigned URL. Prints the HTTP status.
put_part() {
  local part_number=$1 url=$2
  dd if="$FILE" bs="$PART_SIZE" skip=$((part_number - 1)) count=1 2>/dev/null |
    curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type:' --data-binary @- "$url"
}

# Uploads every part that BODY (a part-URLs response) offers a URL for.
put_offered_parts() {
  local part_number url
  while read -r part_number url; do
    check "part $part_number uploaded straight to S3" 200 "$(put_part "$part_number" "$url")"
  done < <(jq -r '.urls[] | "\(.partNumber) \(.url)"' <<<"$BODY")
}

cleanup() {
  set +e
  echo
  echo "Cleanup:"
  rm -rf "$WORK_DIR" "$INPUT_FILE"
  if [[ -n "$USER_ID" ]]; then
    local id
    for id in $VIDEO_ID $ABORTED_ID; do
      aws s3 rm "s3://$BUCKET/uploads/$USER_ID/$id/" --recursive --profile "$PROFILE" >/dev/null
      aws s3api list-multipart-uploads --bucket "$BUCKET" --prefix "uploads/$USER_ID/$id/" \
        --profile "$PROFILE" --query 'Uploads[].[Key,UploadId]' --output text |
        while read -r key upload_id; do
          [[ "$key" == "None" || -z "$key" ]] && continue
          aws s3api abort-multipart-upload --bucket "$BUCKET" --key "$key" \
            --upload-id "$upload_id" --profile "$PROFILE"
        done
      aws dynamodb delete-item --table-name "$TABLE" --profile "$PROFILE" \
        --key "{\"PK\":{\"S\":\"VIDEO#$id\"},\"SK\":{\"S\":\"META\"}}"
    done
    if [[ "$COMPLETED" == true ]]; then
      # Give the test's bytes back so the account ends where it started.
      aws dynamodb update-item --table-name "$TABLE" --profile "$PROFILE" \
        --key "{\"PK\":{\"S\":\"USER#$USER_ID\"},\"SK\":{\"S\":\"PROFILE\"}}" \
        --update-expression 'ADD bytesUsed :negative' \
        --expression-attribute-values "{\":negative\":{\"N\":\"-$SIZE_BYTES\"}}"
    fi
  fi
  echo "   test file, S3 objects and table records removed"
}
trap cleanup EXIT

sign_in
api GET health
USER_ID=$(jq -r '.userId' <<<"$BODY")

echo
echo "1) Storage before"
api GET me/storage
check "GET /me/storage" 200 "$STATUS"
BYTES_BEFORE=$(jq -r '.bytesUsed' <<<"$BODY")
echo "   bytesUsed: $BYTES_BEFORE of $(jq -r '.quotaBytes' <<<"$BODY")"

echo
echo "2) Start a 100 MB upload"
head -c "$SIZE_BYTES" /dev/urandom >"$FILE"
api POST uploads "{\"fileName\":\"smoke-test.mp4\",\"sizeBytes\":$SIZE_BYTES,\"title\":\"Smoke test\"}"
check "POST /uploads" 201 "$STATUS"
VIDEO_ID=$(jq -r '.videoId' <<<"$BODY")
PART_SIZE=$(jq -r '.partSizeBytes' <<<"$BODY")
PART_COUNT=$(jq -r '.partCount' <<<"$BODY")
check "split into 7 parts of 16 MiB" "7 x 16777216" "$PART_COUNT x $PART_SIZE"

echo
echo "3) Upload only the first 3 parts, then get interrupted"
api GET "uploads/$VIDEO_ID/parts?limit=3"
check "GET parts?limit=3 offers 3 URLs" 3 "$(jq '.urls | length' <<<"$BODY")"
put_offered_parts
api POST "uploads/$VIDEO_ID/complete"
check "completing too early is refused" "409 UPLOAD_INCOMPLETE" "$STATUS $(jq -r '.error.code' <<<"$BODY")"

echo
echo "4) Resume: the API only offers the missing parts"
api GET "uploads/$VIDEO_ID/parts"
check "parts already in S3" "[1,2,3]" "$(jq -c '.uploadedPartNumbers' <<<"$BODY")"
check "parts still to upload" "[4,5,6,7]" "$(jq -c '[.urls[].partNumber]' <<<"$BODY")"
put_offered_parts

echo
echo "5) Complete"
api POST "uploads/$VIDEO_ID/complete"
check "POST complete" 200 "$STATUS"
[[ "$STATUS" == 200 ]] && COMPLETED=true
check "video is uploaded and awaiting moderation" "uploaded pending" \
  "$(jq -r '"\(.uploadStatus) \(.moderationStatus)"' <<<"$BODY")"
check "size measured by S3" "$SIZE_BYTES" "$(jq -r '.sizeBytes' <<<"$BODY")"
check "original stored under the user's folder" "$SIZE_BYTES" \
  "$(aws s3api head-object --bucket "$BUCKET" --profile "$PROFILE" \
    --key "uploads/$USER_ID/$VIDEO_ID/original.mp4" --query ContentLength --output text 2>&1)"
api GET me/storage
check "bytesUsed grew by exactly 100 MB" "$((BYTES_BEFORE + SIZE_BYTES))" "$(jq -r '.bytesUsed' <<<"$BODY")"

echo
echo "6) Rejections"
api POST "uploads/$VIDEO_ID/complete"
check "completing twice" "409 INVALID_STATE" "$STATUS $(jq -r '.error.code' <<<"$BODY")"
api POST uploads '{"fileName":"notes.pdf","sizeBytes":1000}'
check "a PDF" "415 UNSUPPORTED_FORMAT" "$STATUS $(jq -r '.error.code' <<<"$BODY")"
api POST uploads '{"fileName":"huge.mp4","sizeBytes":999999999999}'
check "a file bigger than the free quota" "413 QUOTA_EXCEEDED" "$STATUS $(jq -r '.error.code' <<<"$BODY")"
api POST uploads '{"fileName":"clip.mp4"}'
check "a request without a size" "400 VALIDATION" "$STATUS $(jq -r '.error.code' <<<"$BODY")"
api GET "uploads/does-not-exist/parts"
check "an unknown video" "404 NOT_FOUND" "$STATUS $(jq -r '.error.code' <<<"$BODY")"

echo
echo "7) Abort a second upload"
api POST uploads '{"fileName":"abandoned.mov","sizeBytes":20971520}'
ABORTED_ID=$(jq -r '.videoId' <<<"$BODY")
api GET "uploads/$ABORTED_ID/parts?limit=1"
put_offered_parts
api DELETE "uploads/$ABORTED_ID"
check "DELETE /uploads/{id}" 204 "$STATUS"
api GET "uploads/$ABORTED_ID/parts"
check "the aborted upload is gone" 404 "$STATUS"
check "no leftover parts in S3" "None" \
  "$(aws s3api list-multipart-uploads --bucket "$BUCKET" --profile "$PROFILE" \
    --prefix "uploads/$USER_ID/$ABORTED_ID/" --query 'Uploads' --output text)"
api GET me/storage
check "bytesUsed unchanged by the abort" "$((BYTES_BEFORE + SIZE_BYTES))" "$(jq -r '.bytesUsed' <<<"$BODY")"

echo
if ((FAILURES == 0)); then
  echo "All checks passed."
else
  echo "$FAILURES check(s) FAILED."
  exit 1
fi
