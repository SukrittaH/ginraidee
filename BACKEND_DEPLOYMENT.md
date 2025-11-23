# Backend Deployment Guide

This guide will help you deploy the Ginraidee backend API to Azure App Service.

## Prerequisites

1. **Azure Account** (Free tier available)
2. **Azure CLI** installed locally
3. **Node.js 22 LTS** installed locally
4. **PostgreSQL Database** - Choose one:
   - Azure Database for PostgreSQL (flexible server)
   - Supabase (free tier)
   - Neon (free tier with generous limits)

## Architecture

```
Mobile App (React Native)
    ↓
Backend API (Azure App Service)
    ↓
┌─────────────────┬─────────────────┐
│  Azure OpenAI   │   PostgreSQL    │
│                 │   (Database)    │
└─────────────────┴─────────────────┘
```

## Step 1: Set Up PostgreSQL Database

### Option A: Neon (Recommended - Free & Fast)

1. Go to [Neon](https://neon.tech)
2. Sign up with GitHub
3. Create a new project: "ginraidee"
4. Get connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/ginraidee?sslmode=require
   ```

**Free Tier:**
- 0.5 GB storage
- Auto-scaling compute
- No credit card required

### Option B: Supabase (Free)

1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Get PostgreSQL connection string from Project Settings > Database
   ```
   postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
   ```

**Free Tier:**
- 500 MB database
- 2 GB bandwidth/month
- Auto-pause after inactivity

### Option C: Azure Database for PostgreSQL

1. Go to Azure Portal
2. Create **Azure Database for PostgreSQL flexible server**
   - SKU: Burstable B1ms (cheapest ~$12/month)
   - Or use free trial credits
3. Get connection string:
   ```
   postgresql://user@server:password@server.postgres.database.azure.com:5432/ginraidee?sslmode=require
   ```

## Step 2: Create Azure App Service

### Via Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Web App**:
   - **Name**: `ginraidee-api` (must be globally unique)
   - **Runtime**: Node 22 LTS
   - **Region**: Choose closest to your users
   - **Pricing**: F1 Free tier (for testing) or B1 Basic (for production)

### Via Azure CLI:

```bash
# Login to Azure
az login

# Create resource group
az group create --name ginraidee-rg --location eastus

# Create App Service plan
az appservice plan create \
  --name ginraidee-plan \
  --resource-group ginraidee-rg \
  --sku F1 \
  --is-linux

# Create Web App
az webapp create \
  --name ginraidee-api \
  --resource-group ginraidee-rg \
  --plan ginraidee-plan \
  --runtime "NODE:22-lts"
```

## Step 3: Configure Environment Variables

In Azure Portal > Your Web App > **Configuration** > **Application Settings**, add:

```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
DATABASE_URL=postgresql://user:password@host:5432/ginraidee?sslmode=require
JWT_SECRET=generate-a-strong-random-string-here
NODE_ENV=production
PORT=8080
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Get Publish Profile

1. In Azure Portal > Your Web App
2. Click **Download publish profile**
3. Save the file (you'll upload it to GitHub)

## Step 5: Set Up GitHub Secrets

Go to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**

Add these secrets:

1. **AZURE_WEBAPP_NAME**: `ginraidee-api` (your app name)
2. **AZURE_WEBAPP_PUBLISH_PROFILE**: Paste contents of the publish profile file

## Step 6: Deploy

### Option A: Automatic Deployment (GitHub Actions)

The workflow is already set up! Just push to main:

```bash
git add .
git commit -m "Add backend API"
git push origin main
```

The GitHub Action will automatically deploy when you push changes to the `backend/` directory.

### Option B: Manual Deployment (Azure CLI)

```bash
cd backend
npm install

# Build deployment package
zip -r deploy.zip . -x "node_modules/*" -x ".env"

# Deploy
az webapp deployment source config-zip \
  --resource-group ginraidee-rg \
  --name ginraidee-api \
  --src deploy.zip
```

### Option C: Deploy from VS Code

1. Install **Azure App Service** extension
2. Right-click on `backend` folder
3. Select **Deploy to Web App**
4. Choose your app service

## Step 7: Verify Deployment

Check if your API is running:

```bash
curl https://ginraidee-api.azurewebsites.net/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T...",
  "service": "Ginraidee API"
}
```

## Step 8: Test API Endpoints

### Register User
```bash
curl -X POST https://ginraidee-api.azurewebsites.net/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "language": "en"
  }'
```

### Login
```bash
curl -X POST https://ginraidee-api.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Inventory (requires auth token)
```bash
curl https://ginraidee-api.azurewebsites.net/api/inventory \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Inventory
- `GET /api/inventory` - Get all items
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `GET /api/inventory/expiring/soon` - Get expiring items
- `GET /api/inventory/by-date/:date` - Get items by date

### Recipes
- `POST /api/recipes/generate` - Generate recipe
- `POST /api/recipes/suggest` - Suggest recipes by inventory

## Monitoring

### View Logs

**Via Azure Portal:**
1. Go to your Web App
2. **Monitoring** > **Log stream**

**Via CLI:**
```bash
az webapp log tail \
  --resource-group ginraidee-rg \
  --name ginraidee-api
```

### Application Insights (Optional)

Enable Application Insights for advanced monitoring:
1. Azure Portal > Your Web App > **Application Insights**
2. Click **Turn on Application Insights**

## Troubleshooting

### Deployment Failed
- Check GitHub Actions logs
- Verify all environment variables are set
- Check Azure App Service logs

### Database Connection Error
- Verify PostgreSQL connection string
- Ensure SSL mode is set correctly (`?sslmode=require`)
- Check firewall rules (Azure) or allowed IPs (Neon/Supabase)
- Test connection locally first

### API Returns 500 Error
- Check Application Logs in Azure Portal
- Verify Azure OpenAI credentials
- Ensure all environment variables are set

## Cost Estimation

**Free Tier (F1):**
- ✅ Good for development/testing
- 60 CPU minutes/day
- 1 GB RAM
- 1 GB storage

**Basic Tier (B1) - ~$13/month:**
- ✅ Recommended for production
- Always-on
- 1.75 GB RAM
- 10 GB storage
- Custom domain support

**Neon PostgreSQL Free Tier:**
- 0.5 GB storage
- Auto-scaling compute
- Always-free tier
- ✅ Best for development and small apps

**Supabase PostgreSQL Free Tier:**
- 500 MB storage
- Auto-pause after inactivity
- ✅ Good for small apps

## Scaling

When your app grows:

1. **Upgrade App Service Plan:**
   ```bash
   az appservice plan update \
     --name ginraidee-plan \
     --resource-group ginraidee-rg \
     --sku B1
   ```

2. **Enable Auto-scaling:**
   - Azure Portal > App Service Plan > **Scale out**

3. **Upgrade Database:**
   - Neon: Upgrade to Pro for more storage and compute
   - Azure PostgreSQL: Upgrade to General Purpose tier

## Security Checklist

- ✅ Use strong JWT_SECRET
- ✅ Enable HTTPS only
- ✅ Set proper CORS origins
- ✅ Rotate API keys regularly
- ✅ Use managed identities (advanced)
- ✅ Enable Azure DDoS protection

## Next Steps

1. Update mobile app to use backend API
2. Implement rate limiting
3. Add caching (Redis)
4. Set up CI/CD testing
5. Configure custom domain
6. Enable SSL certificate

## Resources

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Neon PostgreSQL](https://neon.tech/docs)
- [Supabase](https://supabase.com/docs)
- [Sequelize ORM Docs](https://sequelize.org/docs/v6/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
