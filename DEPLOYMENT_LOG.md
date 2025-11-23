# Ginraidee Automatic Deployment Log

## Session Start: 2025-11-21

### Goal
Deploy backend API to Azure App Service and connect React Native frontend automatically via GitHub Actions.

---

## Step 1: Azure App Service Setup

**Status**: ✅ COMPLETED

- [x] Created App Service in Azure Portal
- [x] App Service Name: `ginraidee-api`
- [x] Runtime: Node 22 LTS
- [x] Pricing Tier: F1 Free / B1 Basic

---

## Step 2: Download Publish Profile

**Status**: ✅ COMPLETED

- [x] Go to Azure Portal > Your App Service
- [x] Click "Download publish profile" (top right button)
- [x] Downloaded file: `ginraidee-api.PublishSettings`

---

## Step 3: Set Up GitHub Secrets

**Status**: ✅ COMPLETED (Updated with fresh profile)

Added secrets to GitHub:
1. [x] `AZURE_WEBAPP_NAME` = `ginraidee-api`
2. [x] `AZURE_WEBAPP_PUBLISH_PROFILE` = Fresh XML file contents (updated)

---

## Step 4: Configure Environment Variables in Azure

**Status**: ✅ COMPLETED

Set in Azure App Service > Configuration > Application Settings:
- [x] POSTGRES_CONNECTION_STRING = postgresql://pgadmin:cf84Qv%2Fv%3C1ZV@ginraidee-dev-sea-pgsql-sv.postgres.database.azure.com:5432/ginraidee?sslmode=require
- [x] AZURE_OPENAI_ENDPOINT = https://ginraidee-dev-eus2-oai.openai.azure.com/
- [x] AZURE_OPENAI_API_KEY = 1Fy1NJp5IoXBH8kxnbTHJJvcOiCCAR7C89otQOwvf4wq8irGb0L3JQQJ99BKACHYHv6XJ3w3AAABACOGqR2V
- [x] AZURE_OPENAI_DEPLOYMENT_NAME = gpt-5-hat
- [x] JWT_SECRET = 888a35db6a378735c686ae67dd5e69820ab7a8eec4d29e6a11f86e3f92119e41
- [x] NODE_ENV = production
- [x] PORT = 8080

---

## Step 5: Deploy via GitHub Actions

**Status**: ✅ IN PROGRESS

- [x] Commit changes
- [x] Push to main branch
- [x] GitHub Actions workflow triggered automatically
- [ ] Verify deployment in Azure Portal

**Deployment Time**: ~5-10 minutes

---

## Step 6: Update Frontend API URL

**Status**: ⏳ PENDING

Update `.env` file:
```
REACT_APP_API_BASE_URL=https://[APP_SERVICE_NAME].azurewebsites.net/api
```

---

## Step 7: Test End-to-End

**Status**: ⏳ PENDING

- [ ] Open app on iOS simulator
- [ ] Add inventory item
- [ ] Verify it saves to Azure PostgreSQL
- [ ] Generate recipe
- [ ] All features working

---

## Notes & Issues

### Issue 1: iOS Simulator Network
- **Problem**: Cannot reach `192.168.1.55:3000` from simulator
- **Solution**: Deploy to Azure with public URL

### Issue 2: Auth Headers
- **Problem**: `Authorization: Bearer null` was blocking requests
- **Solution**: Removed all auth headers from apiService.js

---

## Completion Checklist

- [ ] App Service created
- [ ] Publish profile downloaded
- [ ] GitHub secrets configured
- [ ] Environment variables set in Azure
- [ ] GitHub Actions deployment successful
- [ ] Frontend URL updated to Azure endpoint
- [ ] App tested and working end-to-end

