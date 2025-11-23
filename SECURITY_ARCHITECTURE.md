# Security Architecture - Ginraidee

## Overview

The Ginraidee app follows a secure client-server architecture where sensitive credentials are kept on the backend only.

## Architecture Diagram

```
┌─────────────────────────────────┐
│   Mobile App (React Native)     │
│  - No sensitive credentials     │
│  - Calls backend APIs only      │
│  - JWT token in memory          │
└────────────────┬────────────────┘
                 │
        HTTPS (API Requests)
                 │
┌────────────────▼────────────────┐
│   Backend API (Node.js)         │
│  - Stores all secrets in .env   │
│  - Azure OpenAI credentials     │
│  - Database credentials         │
│  - JWT signing key              │
└────────────────┬────────────────┘
                 │
        SQL/SSL (Database)
                 │
┌────────────────▼────────────────┐
│   PostgreSQL Database (Azure)   │
│  - User accounts                │
│  - Inventory items              │
│  - User preferences             │
└─────────────────────────────────┘
```

## Secure Components

### 1. Mobile App (Client-Side)
✅ **No secrets stored locally**
- No API keys
- No database credentials
- No Azure OpenAI keys

✅ **Authentication via JWT**
- Token obtained after login
- Token stored in `APIService.authToken`
- Token sent in Authorization header

✅ **API Communication**
- `APIService` handles all HTTP requests
- All requests go through `/api/` endpoints
- Credentials in `.env` are for development only

### 2. Backend API (Server-Side)
✅ **All credentials in `.env`**
```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT_NAME=...
POSTGRES_CONNECTION_STRING=...
JWT_SECRET=...
```

✅ **Secure Endpoints**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/inventory` - List user inventory
- `POST /api/inventory` - Create inventory item
- `POST /api/recipes/generate` - Generate recipes (Azure OpenAI)

✅ **Middleware**
- Authentication middleware checks JWT token
- All protected routes require valid token

### 3. Database (PostgreSQL)
✅ **Encrypted Connection**
- `sslmode=require` in connection string
- Azure PostgreSQL with firewall rules
- Password URL-encoded for special characters

## Data Flow Examples

### User Registration
```
1. Mobile App → POST /api/auth/register
   (email, password, name)
         ↓
2. Backend receives request
   (no sensitive data from client yet)
         ↓
3. Backend hashes password with bcrypt
   (sensitive operation on server)
         ↓
4. Backend stores user in PostgreSQL
   (encrypted connection)
         ↓
5. Backend generates JWT token
   (using JWT_SECRET from .env)
         ↓
6. Backend returns token to app
   (app stores in memory only)
```

### Recipe Generation
```
1. Mobile App sends ingredients list
   POST /api/recipes/generate
   (no credentials sent)
         ↓
2. Backend receives request
   (authenticates with JWT token)
         ↓
3. Backend loads Azure OpenAI credentials
   from .env file
         ↓
4. Backend calls Azure OpenAI API
   (using keys from .env)
         ↓
5. Azure OpenAI returns recipe
         ↓
6. Backend sends recipe to app
   (app displays in UI)
```

## Environment Variables

### Backend `.env` (Server-Side - SECURE)
```
# Database
POSTGRES_CONNECTION_STRING=postgresql://...

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_API_KEY=xxxxx
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-chat

# JWT
JWT_SECRET=random-secure-key-here
```

### Mobile App `.env` (Development Only)
```
# Mobile app .env is NOT used for secrets
# These are just for local testing setup
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_API_KEY=YOUR_NEW_REGENERATED_KEY_HERE
```

**NOTE:** Mobile app `.env` credentials are NOT used! They're just placeholders. All actual API calls go through the backend.

## Security Best Practices

### ✅ Do This
- Store all credentials on backend
- Use environment variables for secrets
- Never expose API keys in frontend code
- Use HTTPS for all API requests
- Implement JWT authentication
- Hash passwords with bcrypt
- Use database SSL connections
- Validate all inputs on backend
- Log security events

### ❌ Don't Do This
- Don't expose credentials in code
- Don't send API keys from frontend
- Don't store sensitive data in local storage
- Don't trust client-side validation
- Don't hardcode passwords
- Don't commit `.env` files to git
- Don't use HTTP (always HTTPS)

## Authentication Flow

```
1. User Registration
   ┌─────────────────────────────────┐
   │ Mobile App                      │
   │ Email: user@example.com         │
   │ Password: secret123             │
   └──────────────┬──────────────────┘
                  │ POST /api/auth/register
                  ▼
   ┌─────────────────────────────────┐
   │ Backend API                     │
   │ 1. Hash password                │
   │ 2. Store in DB                  │
   │ 3. Generate JWT                 │
   │ 4. Return token                 │
   └──────────────┬──────────────────┘
                  │ JWT Token
                  ▼
   ┌─────────────────────────────────┐
   │ Mobile App                      │
   │ Store token in memory           │
   │ (APIService.authToken)          │
   └─────────────────────────────────┘

2. Subsequent Requests
   ┌─────────────────────────────────┐
   │ Mobile App                      │
   │ GET /api/inventory              │
   │ Authorization: Bearer <token>   │
   └──────────────┬──────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────┐
   │ Backend API                     │
   │ 1. Verify JWT token             │
   │ 2. Extract userId               │
   │ 3. Query user's inventory       │
   │ 4. Return data                  │
   └──────────────┬──────────────────┘
                  │ User's inventory data
                  ▼
   ┌─────────────────────────────────┐
   │ Mobile App                      │
   │ Display inventory               │
   └─────────────────────────────────┘
```

## Deployment Security

### Production Checklist
- [ ] Set strong `JWT_SECRET` in production
- [ ] Use Azure Key Vault for secrets
- [ ] Enable Azure PostgreSQL firewall
- [ ] Use HTTPS only
- [ ] Implement rate limiting
- [ ] Enable database backups
- [ ] Set up monitoring/logging
- [ ] Implement CORS properly
- [ ] Use environment-specific configs
- [ ] Rotate credentials regularly

## Summary

✅ **Mobile app is stateless** - no secrets stored locally
✅ **Backend is secure** - all credentials in environment variables
✅ **Communication is authenticated** - JWT tokens for all requests
✅ **Database is encrypted** - SSL connections required
✅ **Ready for production** - follows security best practices
