# Ginraidee Backend API

Express.js backend API for the Ginraidee food inventory management app.

## Features

- 🔐 User authentication with JWT
- 📦 Inventory management (CRUD operations)
- 🤖 AI-powered recipe suggestions using Azure OpenAI
- 📊 PostgreSQL database integration
- 🔒 Secure API with helmet and CORS
- 📝 Request logging with Morgan

## Tech Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Express.js
- **Database**: PostgreSQL (Sequelize ORM)
- **AI**: Azure OpenAI
- **Authentication**: JWT + bcrypt
- **Deployment**: Azure App Service

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
- Azure OpenAI endpoint and API key
- MongoDB connection string
- JWT secret

### 3. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","timestamp":"...","service":"Ginraidee API"}
```

## API Documentation

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-app.azurewebsites.net`

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "language": "en"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Returns JWT token to use in subsequent requests.

### Inventory Endpoints

All inventory endpoints require authentication. Include token in header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Get All Items
```http
GET /api/inventory
```

#### Create Item
```http
POST /api/inventory
Content-Type: application/json

{
  "name": "Tomato",
  "category": "vegetables",
  "quantity": 5,
  "unit": "pcs",
  "expirationDate": "2025-01-25",
  "emoji": "🍅",
  "backgroundColor": "#FF6B6B"
}
```

#### Update Item
```http
PUT /api/inventory/:id
Content-Type: application/json

{
  "quantity": 3
}
```

#### Delete Item
```http
DELETE /api/inventory/:id
```

#### Get Expiring Items
```http
GET /api/inventory/expiring/soon
```

Returns items expiring within 3 days.

#### Get Items by Date
```http
GET /api/inventory/by-date/2025-01-20
```

### Recipe Endpoints

#### Generate Recipe
```http
POST /api/recipes/generate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "craving": "pasta",
  "language": "en"
}
```

#### Suggest Recipes by Expiring Ingredients
```http
POST /api/recipes/suggest
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "language": "en"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── azure.js          # Azure OpenAI configuration
│   │   └── database.js       # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── inventoryController.js
│   │   └── recipeController.js
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── models/
│   │   ├── User.js
│   │   └── Inventory.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── inventory.js
│   │   └── recipes.js
│   └── server.js             # Main entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Deployment

See [BACKEND_DEPLOYMENT.md](../BACKEND_DEPLOYMENT.md) for detailed deployment instructions to Azure App Service.

### Quick Deploy to Azure

```bash
# Login to Azure
az login

# Create and deploy (see BACKEND_DEPLOYMENT.md for full steps)
az webapp up --name your-app-name --runtime "NODE:18-lts"
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | `https://....openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Deployment name | `gpt-4` |
| `JWT_SECRET` | JWT signing secret | Random string |

## Development

### Run with Nodemon
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Helmet for HTTP security headers
- CORS configured
- Input validation with express-validator
- Environment variables for secrets

## License

MIT
