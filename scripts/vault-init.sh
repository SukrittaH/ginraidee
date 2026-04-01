#!/bin/sh
# Vault Initialization Script
# Seeds secrets into Vault for local development
# Run automatically by vault-init container on startup

set -e

echo "⏳ Waiting for Vault to be ready..."
sleep 5

echo "🔐 Initializing Vault secrets..."

# Enable KV v2 secrets engine
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "ℹ️  Secret engine already enabled"

# ===== AUTH SERVICE SECRETS =====
echo "📝 Storing auth-service secrets..."
vault kv put secret/auth-service \
  jwt_secret="dev-secret-key-change-in-production" \
  entraid_client_id="YOUR_ENTRAID_CLIENT_ID" \
  entraid_tenant_id="common" \
  entraid_authority="https://login.microsoftonline.com/common" \
  entraid_issuer="https://login.microsoftonline.com/common/v2.0" \
  entraid_jwks_uri="https://login.microsoftonline.com/common/discovery/v2.0/keys"

echo "✅ Auth service secrets stored"

# ===== RECIPE SERVICE SECRETS =====
echo "📝 Storing recipe-service secrets..."
vault kv put secret/recipe-service \
  jwt_secret="dev-secret-key-change-in-production" \
  azure_openai_api_key="YOUR_AZURE_OPENAI_KEY" \
  azure_openai_endpoint="YOUR_AZURE_OPENAI_ENDPOINT" \
  azure_openai_deployment_name="gpt-4o"

echo "✅ Recipe service secrets stored"

# ===== OCR SERVICE SECRETS =====
echo "📝 Storing ocr-service secrets..."
vault kv put secret/ocr-service \
  jwt_secret="dev-secret-key-change-in-production" \
  azure_document_intelligence_endpoint="YOUR_AZURE_DI_ENDPOINT" \
  azure_document_intelligence_key="YOUR_AZURE_DI_KEY"

echo "✅ OCR service secrets stored"

# ===== INVENTORY SERVICE SECRETS =====
echo "📝 Storing inventory-service secrets..."
vault kv put secret/inventory-service \
  jwt_secret="dev-secret-key-change-in-production"

echo "✅ Inventory service secrets stored"

# ===== DATABASE CREDENTIALS =====
echo "📝 Storing database secrets..."
vault kv put secret/database \
  url="postgresql://postgres:password@postgres:5432/ginraidee" \
  username="postgres" \
  password="password" \
  host="postgres" \
  port="5432" \
  database="ginraidee"

echo "✅ Database secrets stored"

# List all secrets
echo ""
echo "📋 Stored secret paths:"
vault kv list secret/ 2>/dev/null || echo "No secrets found"

echo ""
echo "✅ Vault initialization complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Vault Access Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Root Token: dev-root-token"
echo "Vault UI:   http://localhost:8200"
echo "Vault API:  http://localhost:8200/v1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Quick Commands:"
echo "  Read secret:   vault kv get secret/auth-service"
echo "  Update secret: vault kv put secret/auth-service jwt_secret=new-value"
echo "  Delete secret: vault kv delete secret/auth-service"
echo ""
