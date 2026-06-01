#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VAR_FILE="$SCRIPT_DIR/backend/.dev.vars"
eval "$(grep -v '^#' "$SCRIPT_DIR/.env" | sed 's/^/export /')"
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  eval "$(grep -v '^#' "$SCRIPT_DIR/.env.local" | sed 's/^/export /')"
fi
cat > "$VAR_FILE" << VAREOF
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
WEBSITE_URL="${WEBSITE_URL}"
JWT_SECRET="dev-jwt-secret-not-for-production"
VAREOF
echo "synced .dev.vars"
