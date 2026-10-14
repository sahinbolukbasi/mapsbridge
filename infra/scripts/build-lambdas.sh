#!/bin/bash
# MapsBridge Lambda Build Script
# Bundles each domain handler with esbuild + creates shared Lambda layer
# Usage: ./scripts/build-lambdas.sh
#
# Prerequisites:
#   npm install -g esbuild
#   cd infra/lambda && npm install

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infra"
TERRAFORM_DIR="$INFRA_DIR/terraform"
LAMBDA_DIR="$INFRA_DIR/lambda/src"
BUILD_DIR="$TERRAFORM_DIR/.build"
LAYER_DIR="$BUILD_DIR/layer"
export PATH="$PROJECT_ROOT/apps/web/node_modules/.bin:$PATH"

echo "=== MapsBridge Lambda Build ==="
echo "Project root: $PROJECT_ROOT"
echo "Build dir:    $BUILD_DIR"

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/lambdas"
mkdir -p "$BUILD_DIR/ai"
mkdir -p "$LAYER_DIR/nodejs"

# Build local AI handler bundle for tests & direct runner
npx esbuild "$LAMBDA_DIR/ai/index.ts" \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile="$BUILD_DIR/ai/handler.cjs"

# ─── Domain handlers ──────────────────────────────────────────────────────
DOMAINS=("auth" "routes" "chat" "marketplace" "stripe" "admin" "ai" "operations" "places" "kb-ingest" "background-monitor")

for domain in "${DOMAINS[@]}"; do
  echo ""
  echo "→ Building domain: $domain"
  npx esbuild "$LAMBDA_DIR/$domain/index.ts" \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --minify \
    --outfile="$BUILD_DIR/lambdas/$domain/index.js"

  # Zip
  (cd "$BUILD_DIR/lambdas/$domain" && zip -q -r "$BUILD_DIR/lambdas/$domain.zip" .)
  echo "  ✓ $domain.zip ($(wc -c < "$BUILD_DIR/lambdas/$domain.zip") bytes)"
done

# ─── Cognito Custom Message handler ──────────────────────────────────────
echo ""
echo "→ Building Cognito Custom Message handler"
mkdir -p "$BUILD_DIR/lambdas/cognito-custom-message"
npx esbuild "$LAMBDA_DIR/auth/cognito-custom-message.ts" \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --minify \
  --outfile="$BUILD_DIR/lambdas/cognito-custom-message/index.js"
(cd "$BUILD_DIR/lambdas/cognito-custom-message" && zip -q -r "$BUILD_DIR/lambdas/cognito-custom-message.zip" .)
echo "  ✓ cognito-custom-message.zip"

# ─── WebSocket handlers ───────────────────────────────────────────────────
echo ""
echo "→ Building WebSocket handlers"
for ws_handler in "onconnect" "onmessage" "ondisconnect"; do
  npx esbuild "$LAMBDA_DIR/ws/$ws_handler.ts" \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --minify \
    --outfile="$BUILD_DIR/lambdas/ws-$ws_handler/index.js"

  (cd "$BUILD_DIR/lambdas/ws-$ws_handler" && zip -q -r "$BUILD_DIR/lambdas/ws-$ws_handler.zip" .)
  echo "  ✓ ws-$ws_handler.zip"
done



# ─── Shared Lambda Layer ──────────────────────────────────────────────────
echo ""
echo "→ Building shared Lambda layer"
# Copy node_modules from infra/lambda
if [ -d "$LAMBDA_DIR/../node_modules" ]; then
  cp -r "$LAMBDA_DIR/../node_modules" "$LAYER_DIR/nodejs/"
  echo "  ✓ node_modules copied"
else
  echo "  ⚠ No node_modules found in infra/lambda. Run: cd infra/lambda && npm install"
fi

# Zip layer
(cd "$BUILD_DIR" && zip -q -r "layer/shared.zip" "layer/")
echo "  ✓ shared.zip ($(wc -c < "$BUILD_DIR/layer/shared.zip") bytes)"

echo ""
echo "=== Build complete ==="
echo "Output: $BUILD_DIR"
ls -lh "$BUILD_DIR/lambdas/"*.zip "$BUILD_DIR/layer/shared.zip"