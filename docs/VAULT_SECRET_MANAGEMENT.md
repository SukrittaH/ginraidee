# Vault Secret Management Guide

How to update and manage secrets in HashiCorp Vault for local development.

## 📋 Quick Reference

### Files Overview

| File | Purpose | Safe to Commit? |
|------|---------|----------------|
| `scripts/vault-init.sh` | Template with placeholder secrets | ✅ YES (template only) |
| `scripts/vault-init.local.sh` | Your real local secrets | ❌ NO (in .gitignore) |
| `scripts/vault-init-wrapper.sh` | Chooses which script to use | ✅ YES (no secrets) |

### Priority Order

1. **vault-init.local.sh** - If exists, uses this (your real secrets)
2. **vault-init.sh** - Fallback (template/placeholder secrets)

---

## 🎯 Recommended Workflow

### Initial Setup (One Time)

```bash
# 1. Copy the example to create your local secrets file
cp scripts/vault-init.local.sh.example scripts/vault-init.local.sh

# 2. Edit with your REAL secrets (not committed to git)
nano scripts/vault-init.local.sh

# Replace all "YOUR_*_HERE" placeholders with real values:
# - YOUR_LOCAL_JWT_SECRET_HERE → actual JWT secret
# - YOUR_REAL_AZURE_OPENAI_KEY_HERE → your Azure OpenAI key
# - YOUR_REAL_AZURE_DI_KEY_HERE → your Azure DI key
# etc.

# 3. Make it executable
chmod +x scripts/vault-init.local.sh

# 4. Start Vault (will use your local secrets)
docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d

# 5. Verify secrets loaded
docker logs vault-init
# Should see: "🔐 Using vault-init.local.sh (local secrets)"
```

---

## 🔄 Updating Secrets

### Method 1: Via Vault CLI (Recommended - No Restart)

```bash
# Update a single secret (instant, no restart needed)
docker exec vault-dev vault kv patch secret/auth-service \
  jwt_secret="my-new-secret-value"

# Update multiple fields at once
docker exec vault-dev vault kv patch secret/recipe-service \
  azure_openai_api_key="new-key" \
  azure_openai_endpoint="new-endpoint"

# Restart only the affected service to reload
docker-compose restart auth-service
```

**Pros:**
- ✅ Fast (no Vault restart)
- ✅ Surgical (update only what changed)
- ✅ Persists until Vault restarts

**Cons:**
- ⚠️ Changes lost when Vault restarts (dev mode)
- ⚠️ Must update init script to persist

---

### Method 2: Via Vault UI (Easiest)

```bash
# 1. Open Vault UI
open http://localhost:8200

# 2. Login with token: dev-root-token

# 3. Navigate to: secret/auth-service (or any service)

# 4. Click "Create new version"

# 5. Edit the JSON directly:
{
  "jwt_secret": "my-new-value",
  "entraid_client_id": "..."
}

# 6. Click "Save"

# 7. Restart the service
docker-compose restart auth-service
```

**Pros:**
- ✅ Visual interface
- ✅ Easy to browse all secrets
- ✅ Can see secret history

**Cons:**
- ⚠️ Changes lost when Vault restarts
- ⚠️ Must update init script to persist

---

### Method 3: Update Init Script (Persistent)

**Use this when:**
- You want changes to persist across Vault restarts
- You're updating multiple secrets at once
- You want version control of secret structure

```bash
# 1. Edit your local secrets file
nano scripts/vault-init.local.sh

# 2. Update the secret values
vault kv put secret/auth-service \
  jwt_secret="NEW_VALUE_HERE" \    # ← Change this
  entraid_client_id="f2f1830a-e181-44ed-aa95-e5xxxxxx"

# 3. Restart Vault to re-run init script
docker-compose -f docker-compose.vault.yml restart vault

# Wait for health check
sleep 10

# 4. Re-run init
docker-compose -f docker-compose.vault.yml up vault-init

# 5. Restart your services
docker-compose restart
```

**Pros:**
- ✅ Changes persist across Vault restarts
- ✅ Version controlled (if you want)
- ✅ Good for bulk updates

**Cons:**
- ⚠️ Requires Vault restart (clears all secrets)
- ⚠️ Slower than CLI/UI methods

---

## 🔐 Security Best Practices

### DO ✅

1. **Use vault-init.local.sh for real secrets**
   ```bash
   cp scripts/vault-init.local.sh.example scripts/vault-init.local.sh
   # Edit with real values
   # File is in .gitignore - safe!
   ```

2. **Keep vault-init.sh as template**
   ```bash
   # Only placeholder values
   jwt_secret="dev-secret-key-change-in-production"
   azure_openai_api_key="YOUR_AZURE_OPENAI_KEY"
   ```

3. **Verify .gitignore**
   ```bash
   # Check these are ignored
   cat .gitignore | grep vault-init.local
   # Should show: scripts/vault-init.local.sh
   ```

### DON'T ❌

1. **Don't commit real secrets to vault-init.sh**
   ```bash
   # ❌ BAD - real secrets in committed file
   vault kv put secret/auth-service \
     jwt_secret="prod-secret-abc123xyz"  # DON'T DO THIS!
   ```

2. **Don't use production secrets in local Vault**
   ```bash
   # ❌ BAD - production secrets in dev environment
   # Use different secrets for local dev
   ```

3. **Don't share vault-init.local.sh**
   ```bash
   # ❌ BAD - contains your real keys
   # Each developer should have their own
   ```

---

## 🎓 Common Scenarios

### Scenario 1: New Team Member Setup

```bash
# 1. Clone repo
git clone <repo>

# 2. Create local secrets file
cp scripts/vault-init.local.sh.example scripts/vault-init.local.sh

# 3. Ask team for real secret values
# Update vault-init.local.sh with shared dev secrets

# 4. Start Vault
docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d
```

---

### Scenario 2: Added New Service Secret

```bash
# 1. Update vault-init.local.sh
nano scripts/vault-init.local.sh

# Add new secret:
vault kv put secret/auth-service \
  jwt_secret="existing-value" \
  new_secret="new-value"  # ← Add this

# 2. Restart Vault to re-seed
docker-compose -f docker-compose.vault.yml restart vault
sleep 10
docker-compose -f docker-compose.vault.yml up vault-init

# 3. Restart service
docker-compose restart auth-service
```

---

### Scenario 3: Rotate JWT Secret

```bash
# Option A: Quick update (until Vault restarts)
docker exec vault-dev vault kv patch secret/auth-service \
  jwt_secret="new-rotated-secret-$(date +%s)"
docker-compose restart

# Option B: Persistent update
nano scripts/vault-init.local.sh
# Update jwt_secret value
docker-compose -f docker-compose.vault.yml restart vault
sleep 10
docker-compose -f docker-compose.vault.yml up vault-init
docker-compose restart
```

---

### Scenario 4: Debug Secret Values

```bash
# Read all secrets for a service
docker exec vault-dev vault kv get secret/auth-service

# Read specific field
docker exec vault-dev vault kv get -field=jwt_secret secret/auth-service

# List all service paths
docker exec vault-dev vault kv list secret/

# Check if service can access Vault
docker-compose exec auth-service curl http://vault:8200/v1/sys/health
```

---

## 🚨 Troubleshooting

### Issue: "Using vault-init.sh (template secrets)" but I have vault-init.local.sh

**Cause:** File not mounted or not executable

**Solution:**
```bash
# Check file exists
ls -la scripts/vault-init.local.sh

# Make executable
chmod +x scripts/vault-init.local.sh

# Restart Vault init
docker-compose -f docker-compose.vault.yml up vault-init
```

---

### Issue: Secrets not updating after CLI change

**Cause:** Service hasn't reloaded secrets from Vault

**Solution:**
```bash
# Secrets are loaded on startup - must restart service
docker-compose restart auth-service

# Check logs for reload
docker-compose logs -f auth-service
# Should see: "Loading secrets for auth-service..."
```

---

### Issue: "vault-init.local.sh: not found"

**Cause:** You haven't created your local secrets file yet

**Solution:**
```bash
# Create from template
cp scripts/vault-init.local.sh.example scripts/vault-init.local.sh

# Edit with real values
nano scripts/vault-init.local.sh

# Restart
docker-compose -f docker-compose.vault.yml restart vault vault-init
```

---

### Issue: Accidentally committed secrets

**If you accidentally committed vault-init.local.sh:**

```bash
# 1. Remove from git history (if just committed)
git rm --cached scripts/vault-init.local.sh
git commit -m "Remove accidentally committed secrets"

# 2. Verify .gitignore
echo "scripts/vault-init.local.sh" >> .gitignore

# 3. Rotate all secrets immediately!
# Update all values in vault-init.local.sh
# Restart Vault and services
```

**If committed to vault-init.sh:**
```bash
# 1. Remove real secrets, replace with placeholders
nano scripts/vault-init.sh
# Change: jwt_secret="real-secret"
# To:     jwt_secret="YOUR_JWT_SECRET_HERE"

# 2. Commit changes
git add scripts/vault-init.sh
git commit -m "Replace real secrets with placeholders"

# 3. Consider these secrets compromised
# Rotate immediately in production!
```

---

## 📊 Comparison: Update Methods

| Method | Speed | Persistent | Complexity | Best For |
|--------|-------|------------|------------|----------|
| **CLI** | ⚡ Fast | ❌ No | 🟢 Easy | Quick testing |
| **UI** | ⚡ Fast | ❌ No | 🟢 Very Easy | Browsing/viewing |
| **Init Script** | 🐌 Slow | ✅ Yes | 🟡 Medium | Permanent changes |

**Recommendation:** Use CLI/UI for testing, Init Script for permanent changes.

---

## 🔄 Workflow Summary

```
Day-to-Day Development:
├─ Need to test new secret? → Use CLI/UI (fast)
├─ Found the right value? → Update init script (persist)
└─ Vault restarted? → Secrets auto-reload from init script ✅

New Secret Added to Code:
├─ 1. Add to vault-init.local.sh
├─ 2. Add to secretsManager.js mapping
├─ 3. Restart Vault + services
└─ 4. Commit changes to vault-init.sh (template only!)

Rotate Secret:
├─ 1. Update vault-init.local.sh
├─ 2. Restart Vault to re-seed
└─ 3. Restart affected services
```

---

## ✅ Checklist

Before committing:
- [ ] Real secrets only in `vault-init.local.sh` (gitignored)
- [ ] Only placeholders in `vault-init.sh` (committed)
- [ ] Updated template if structure changed
- [ ] Tested Vault restart loads secrets correctly
- [ ] Documented any new secrets in README

---

## 📚 Related Docs

- [VAULT_QUICKSTART.md](./VAULT_QUICKSTART.md) - 5-minute setup
- [VAULT_IMPLEMENTATION.md](./VAULT_IMPLEMENTATION.md) - Complete guide
- [VAULT_IMPLEMENTATION_SUMMARY.md](../VAULT_IMPLEMENTATION_SUMMARY.md) - Overview

---

## 💡 Pro Tips

1. **Keep both files in sync** - When structure changes, update both vault-init.sh (template) and vault-init.local.sh (real)

2. **Use descriptive placeholders** - `YOUR_AZURE_OPENAI_KEY_HERE` is better than `changeme`

3. **Comment your secrets** - Add comments in init script to document what each secret is for

4. **Regular backups** - Export secrets before major changes:
   ```bash
   docker exec vault-dev vault kv get -format=json secret/auth-service > backup.json
   ```

5. **Version secret structure** - When adding/removing secrets, bump a comment version number in init script

---

**Questions?** Check [VAULT_IMPLEMENTATION.md](./VAULT_IMPLEMENTATION.md) or open an issue!
