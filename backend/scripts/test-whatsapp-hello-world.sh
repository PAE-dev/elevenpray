#!/usr/bin/env bash
# Prueba de envío de plantilla hello_world vía Meta Cloud API.
# Uso:
#   export WHATSAPP_ACCESS_TOKEN="tu_token_nuevo"
#   export WHATSAPP_TO="51987654321"   # tu número en formato internacional sin +
#   ./scripts/test-whatsapp-hello-world.sh

set -euo pipefail

TOKEN="${WHATSAPP_ACCESS_TOKEN:-}"
TO="${WHATSAPP_TO:-}"
PHONE_NUMBER_ID="${WHATSAPP_PHONE_NUMBER_ID:-1079929778544374}"
API_VERSION="${WHATSAPP_API_VERSION:-v25.0}"

if [[ -z "$TOKEN" || -z "$TO" ]]; then
  echo "Define WHATSAPP_ACCESS_TOKEN y WHATSAPP_TO antes de ejecutar."
  exit 1
fi

curl -sS -X POST \
  "https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"${TO}\",
    \"type\": \"template\",
    \"template\": {
      \"name\": \"hello_world\",
      \"language\": { \"code\": \"en_US\" }
    }
  }"

echo ""
