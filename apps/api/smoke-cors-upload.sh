#!/usr/bin/env bash
set -euo pipefail

# One-click smoke test for:
# 1) CORS behavior by environment profile
# 2) Upload image dimension/pixel limits and malformed-image guard
#
# Usage:
#   chmod +x apps/api/smoke-cors-upload.sh
#   BASE_URL=http://127.0.0.1:3000 TOKEN=xxx PROFILE=prod-whitelist \
#   ORIGIN_OK=https://app.example.com ORIGIN_BAD=https://evil.example.com \
#   ./apps/api/smoke-cors-upload.sh
#
# Profiles:
#   dev-open             : non-production and no whitelist (expect "*" for preflight)
#   prod-whitelist       : production + whitelist configured (allow ORIGIN_OK, deny ORIGIN_BAD)
#   prod-empty-whitelist : production + empty whitelist (deny any Origin preflight)

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
UPLOAD_PATH="${UPLOAD_PATH:-/upload/image}"
PROFILE="${PROFILE:-dev-open}"
ORIGIN_OK="${ORIGIN_OK:-https://app.example.com}"
ORIGIN_BAD="${ORIGIN_BAD:-https://evil.example.com}"
TOKEN="${TOKEN:-}"

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cors-upload-smoke.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

say() {
  printf '%s\n' "$*"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  say "PASS: $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  say "FAIL: $*"
}

skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  say "SKIP: $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    say "Missing required command: $cmd"
    exit 2
  fi
}

lower() {
  tr '[:upper:]' '[:lower:]'
}

http_request() {
  local name="$1"
  shift
  local header_file="$TMP_ROOT/${name}.headers"
  local body_file="$TMP_ROOT/${name}.body"
  local code_file="$TMP_ROOT/${name}.code"

  # shellcheck disable=SC2068
  if ! curl -sS -D "$header_file" -o "$body_file" -w "%{http_code}" $@ >"$code_file"; then
    say "curl failed for case: $name"
    return 1
  fi

  RESPONSE_HEADERS_FILE="$header_file"
  RESPONSE_BODY_FILE="$body_file"
  RESPONSE_STATUS_CODE="$(cat "$code_file")"
}

assert_status() {
  local case_name="$1"
  local expected="$2"
  if [[ "$RESPONSE_STATUS_CODE" == "$expected" ]]; then
    pass "$case_name status=$expected"
  else
    fail "$case_name expected status=$expected got=$RESPONSE_STATUS_CODE"
    say "  headers: $RESPONSE_HEADERS_FILE"
    say "  body   : $RESPONSE_BODY_FILE"
  fi
}

header_value() {
  local key_lc="$1"
  awk -v key="$key_lc" '
    BEGIN { IGNORECASE = 1 }
    {
      gsub("\r", "", $0)
      pos = index($0, ":")
      if (pos > 0) {
        k = tolower(substr($0, 1, pos - 1))
        if (k == key) {
          v = substr($0, pos + 1)
          gsub(/^[ \t]+|[ \t]+$/, "", v)
          print v
          exit 0
        }
      }
    }
  ' "$RESPONSE_HEADERS_FILE"
}

assert_header_equals() {
  local case_name="$1"
  local header_key="$2"
  local expected="$3"
  local actual
  actual="$(header_value "$(printf '%s' "$header_key" | lower)")"
  if [[ "$actual" == "$expected" ]]; then
    pass "$case_name header[$header_key]=$expected"
  else
    fail "$case_name header[$header_key] expected '$expected' got '${actual:-<empty>}'"
  fi
}

assert_body_contains() {
  local case_name="$1"
  local needle="$2"
  if rg -q --fixed-strings "$needle" "$RESPONSE_BODY_FILE"; then
    pass "$case_name body contains '$needle'"
  else
    fail "$case_name body missing '$needle'"
    say "  body: $(cat "$RESPONSE_BODY_FILE")"
  fi
}

build_test_images() {
  mkdir -p "$TMP_ROOT/images"

  # Valid 1x1 PNG
  printf '%s' \
    '89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b49444154789c6360600000000300016826590d0000000049454e44ae426082' \
    | xxd -r -p >"$TMP_ROOT/images/ok-1x1.png"

  # Truncated/malformed PNG but with huge width/height in IHDR (10000 x 10000)
  printf '%s' \
    '89504e470d0a1a0a0000000d494844520000271000002710080200000000000000' \
    | xxd -r -p >"$TMP_ROOT/images/dim-10000x10000.png"

  # Truncated/malformed PNG (7000 x 7000 => 49,000,000 pixels)
  printf '%s' \
    '89504e470d0a1a0a0000000d4948445200001b5800001b58080200000000000000' \
    | xxd -r -p >"$TMP_ROOT/images/pixels-7000x7000.png"

  # 1x1 but malformed/truncated body
  printf '%s' \
    '89504e470d0a1a0a0000000d494844520000000100000001080200000000000000' \
    | xxd -r -p >"$TMP_ROOT/images/malformed-1x1.png"
}

run_cors_tests() {
  local url="${BASE_URL}${UPLOAD_PATH}"
  local req_headers='authorization,content-type,x-upload-file-name,x-upload-mime-type'

  case "$PROFILE" in
    dev-open)
      http_request "cors_dev_open_bad_origin" \
        -X OPTIONS "$url" \
        -H "Origin: $ORIGIN_BAD" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: $req_headers"
      assert_status "cors_dev_open_bad_origin" "204"
      assert_header_equals "cors_dev_open_bad_origin" "Access-Control-Allow-Origin" "*"
      ;;
    prod-whitelist)
      http_request "cors_prod_whitelist_good_origin" \
        -X OPTIONS "$url" \
        -H "Origin: $ORIGIN_OK" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: $req_headers"
      assert_status "cors_prod_whitelist_good_origin" "204"
      assert_header_equals "cors_prod_whitelist_good_origin" "Access-Control-Allow-Origin" "$ORIGIN_OK"

      http_request "cors_prod_whitelist_bad_origin" \
        -X OPTIONS "$url" \
        -H "Origin: $ORIGIN_BAD" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: $req_headers"
      assert_status "cors_prod_whitelist_bad_origin" "403"
      assert_body_contains "cors_prod_whitelist_bad_origin" "CORS_ORIGIN_NOT_ALLOWED"
      ;;
    prod-empty-whitelist)
      http_request "cors_prod_empty_whitelist_bad_origin" \
        -X OPTIONS "$url" \
        -H "Origin: $ORIGIN_BAD" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: $req_headers"
      assert_status "cors_prod_empty_whitelist_bad_origin" "403"
      assert_body_contains "cors_prod_empty_whitelist_bad_origin" "CORS_ORIGIN_NOT_ALLOWED"
      ;;
    *)
      say "Unknown PROFILE=$PROFILE"
      say "Allowed: dev-open | prod-whitelist | prod-empty-whitelist"
      exit 2
      ;;
  esac
}

run_upload_tests() {
  local url="${BASE_URL}${UPLOAD_PATH}"
  local auth_header="Authorization: Bearer $TOKEN"

  if [[ -z "$TOKEN" ]]; then
    skip "upload tests skipped: TOKEN is empty"
    return
  fi

  http_request "upload_ok_1x1" \
    -X POST "$url" \
    -H "Content-Type: application/octet-stream" \
    -H "x-upload-file-name: ok-1x1.png" \
    -H "x-upload-mime-type: image/png" \
    -H "$auth_header" \
    --data-binary "@$TMP_ROOT/images/ok-1x1.png"
  assert_status "upload_ok_1x1" "201"
  assert_body_contains "upload_ok_1x1" "image_url"

  http_request "upload_dim_too_large" \
    -X POST "$url" \
    -H "Content-Type: application/octet-stream" \
    -H "x-upload-file-name: dim-10000x10000.png" \
    -H "x-upload-mime-type: image/png" \
    -H "$auth_header" \
    --data-binary "@$TMP_ROOT/images/dim-10000x10000.png"
  assert_status "upload_dim_too_large" "400"
  assert_body_contains "upload_dim_too_large" "IMAGE_DIMENSIONS_TOO_LARGE"

  http_request "upload_pixels_exceeded" \
    -X POST "$url" \
    -H "Content-Type: application/octet-stream" \
    -H "x-upload-file-name: pixels-7000x7000.png" \
    -H "x-upload-mime-type: image/png" \
    -H "$auth_header" \
    --data-binary "@$TMP_ROOT/images/pixels-7000x7000.png"
  assert_status "upload_pixels_exceeded" "400"
  assert_body_contains "upload_pixels_exceeded" "IMAGE_PIXELS_EXCEEDED"

  http_request "upload_malformed" \
    -X POST "$url" \
    -H "Content-Type: application/octet-stream" \
    -H "x-upload-file-name: malformed-1x1.png" \
    -H "x-upload-mime-type: image/png" \
    -H "$auth_header" \
    --data-binary "@$TMP_ROOT/images/malformed-1x1.png"
  assert_status "upload_malformed" "400"
  assert_body_contains "upload_malformed" "INVALID_IMAGE_DIMENSIONS"
}

main() {
  require_cmd curl
  require_cmd xxd
  require_cmd rg

  say "== Smoke test start =="
  say "BASE_URL=$BASE_URL"
  say "UPLOAD_PATH=$UPLOAD_PATH"
  say "PROFILE=$PROFILE"
  say "ORIGIN_OK=$ORIGIN_OK"
  say "ORIGIN_BAD=$ORIGIN_BAD"

  build_test_images
  run_cors_tests
  run_upload_tests

  say ""
  say "== Summary =="
  say "PASS=$PASS_COUNT FAIL=$FAIL_COUNT SKIP=$SKIP_COUNT"
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
