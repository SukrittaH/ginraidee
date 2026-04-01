# Vault Quick Start Guide

Get started with HashiCorp Vault in 5 minutes.

## 🚀 Quick Start (Local Development)

### 1. Start Vault

```bash
# Start Vault with your services
docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d

# Wait 10 seconds for initialization
sleep 10

# Check Vault is running
docker ps | grep vault
```

### 2. Verify Secrets Loaded

```bash
# Check initialization logs
docker logs vault-init

# Expected output:
# ✅ Auth service secrets stored
# ✅ Recipe service secrets stored
# ✅ OCR service secrets stored
# ✅ Inventory service secrets stored
```

### 3. Access Vault UI

1. Open http://localhost:8200
2. Login with token: `dev-root-token`
3. Browse secrets under **secret/**

### 4. Enable Vault in One Service (Test)

```bash
# Enable for auth-service only
cd services/auth-service

# Add to .env
echo "VAULT_ENABLED=true" >> .env
echo "VAULT_TYPE=hashicorp" >> .env
echo "VAULT_ADDR=http://vault:8200" >> .env
echo "VAULT_TOKEN=dev-root-token" >> .env

# Restart service
cd ../..
docker-compose restart auth-service

# Watch logs
docker-compose logs -f auth-service
```

**Expected log output:**
```
[INFO] Loading secrets for auth-service...
[INFO] 🔐 Attempting to load from Vault (type: hashicorp)
[INFO] ✅ Secrets loaded from Vault for auth-service
[INFO] Loaded secrets: 6 from Vault, 0 from environment
```

### 5. Test Fallback to .env

```bash
# Stop Vault
docker-compose -f docker-compose.vault.yml stop vault

# Restart auth-service
docker-compose restart auth-service

# Watch logs - should fallback
docker-compose logs -f auth-service
```

**Expected log output:**
```
[INFO] Loading secrets for auth-service...
[WARN] ⚠️ Vault unavailable, falling back to environment variables
[INFO] Loaded secrets: 0 from Vault, 6 from environment
```

---

## 🔄 Enable for All Services

Once you've verified it works:

```bash
# Enable Vault for all services
for service in auth-service recipe-service ocr-service inventory-service; do
  cd services/$service
  echo "VAULT_ENABLED=true" >> .env
  echo "VAULT_TYPE=hashicorp" >> .env
  echo "VAULT_ADDR=http://vault:8200" >> .env
  echo "VAULT_TOKEN=dev-root-token" >> .env
  cd ../..
done

# Start Vault
docker-compose -f docker-compose.vault.yml up -d

# Restart all services
docker-compose restart
```

---

## 🛠️ Common Tasks

### View a Secret

```bash
# Using Vault CLI
docker exec vault-dev vault kv get secret/auth-service

# Or via UI
open http://localhost:8200
```

### Update a Secret

```bash
# Update single field
docker exec vault-dev vault kv patch secret/auth-service jwt_secret=new-value

# Restart service to reload
docker-compose restart auth-service
```

### Add New Secret

```bash
# Add new field to existing secret
docker exec vault-dev vault kv patch secret/auth-service new_field=new-value
```

---

## 🐛 Troubleshooting

### Vault not starting?

```bash
# Check logs
docker logs vault-dev

# Restart Vault
docker-compose -f docker-compose.vault.yml restart vault
```

### Secrets not loading?

```bash
# Check Vault has secrets
docker exec vault-dev vault kv list secret/

# Re-initialize if empty
docker-compose -f docker-compose.vault.yml up vault-init
```

### Service can't connect to Vault?

```bash
# Check Vault is reachable from service
docker-compose exec auth-service ping vault -c 1

# Check Vault health
docker-compose exec auth-service curl http://vault:8200/v1/sys/health
```

---

## 📊 Status Check

Check which services are using Vault:

```bash
# Check environment variables
docker-compose exec auth-service printenv | grep VAULT

# Check logs for vault messages
docker-compose logs auth-service | grep -i vault
```

---

## ⚡ Pro Tips

1. **Keep .env files** - Vault fallback ensures services work even if Vault is down
2. **Use Vault UI** - Easier than CLI for viewing/editing secrets
3. **Start small** - Enable Vault for one service first, then expand
4. **Check logs** - Services log where secrets come from (Vault vs .env)

---

## 🔐 Vault Cheat Sheet

```bash
# List all secrets
docker exec vault-dev vault kv list secret/

# Read secret
docker exec vault-dev vault kv get secret/auth-service

# Read specific field
docker exec vault-dev vault kv get -field=jwt_secret secret/auth-service

# Write secret
docker exec vault-dev vault kv put secret/auth-service key=value

# Delete secret
docker exec vault-dev vault kv delete secret/auth-service

# Vault status
docker exec vault-dev vault status
```

---

## 📚 Full Documentation

For complete details, see [VAULT_IMPLEMENTATION.md](./VAULT_IMPLEMENTATION.md)

**Topics covered:**
- Production setup with Azure Key Vault
- Code integration examples
- Migration strategies
- Security best practices
- Cost analysis
