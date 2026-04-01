# Ginraidee - Food Inventory Management App

A React Native Expo app for managing your food inventory with expiration tracking, OCR scanning, and AI-powered recipe suggestions.

## Objective

I built Ginraidee to solve my own pain point: **food waste due to lack of ingredient tracking**. I was constantly:
- Forgetting what ingredients I have in my inventory
- Discovering expired items too late to use them
- Struggling to find inspiration for what to cook with what I have on hand

Ginraidee helps me track my food inventory, get notified about expiring items, receive AI-powered recipe suggestions based on what I have available, and quickly scan product labels to extract metadata.

## Features

### 1. Food Inventory Management ✅
Track all your food items with comprehensive management features:
- Add items manually with name, category, quantity, and expiration date
- Edit existing inventory items with modal interface
- Visual categorization with emoji icons (fruits, vegetables, meat, dairy, etc.)
- Expiration status tracking with color-coded indicators:
  - 🔴 Red: Expired items
  - 🟠 Orange: Expires today
  - 🔵 Teal: Expires tomorrow
  - 🟢 Green: Fresh (3+ days)
- Calendar view to see items expiring on specific dates
- Quick date selection (today, tomorrow, 3 days, 1 week)
- Category-based browsing with detailed views
- Bilingual support (Thai/English)

**Current Implementation:**
- ✅ Add item modal with category selection
- ✅ Edit item modal for updates
- ✅ Custom calendar date picker
- ✅ Date detail view showing items expiring on selected dates
- ✅ Category list screen for browsing
- ✅ Expiration status calculation and color coding
- ✅ Multi-language support
- ✅ Backend API with Sequelize ORM and PostgreSQL

### 2. OCR (Optical Character Recognition) ✅
Streamline inventory entry by scanning product labels:
- **Camera integration** - Capture product label images
- **Azure Document Intelligence** - AI-powered text extraction
- **Thai Language Support** - Optimized for Thai product labels
- **Automatic metadata extraction:**
  - Product name recognition (bilingual Thai-English)
  - Expiry date detection with Thai date format support
  - Weight/quantity parsing with decimal support
- **Quick add flow** - Automatically populate inventory with OCR results

**Current Implementation:**
- ✅ Camera screen for image capture
- ✅ Azure Document Intelligence integration (API v2023-07-31)
- ✅ Thai language metadata extraction
- ✅ Product name parsing from bilingual labels
- ✅ Expiry date recognition (Thai + numeric formats)
- ✅ Weight/quantity decimal parsing
- ✅ Backend OCR controller and routes

### 3. AI Recipe Assistant ✅
AI-powered cooking assistant to help you:
- Get recipe suggestions based on available ingredients
- Filter recipes by personal cravings and preferences
- Find creative ways to use items before they expire
- Receive instructions in your preferred language (Thai/English)
- Auto-suggest recipes for items expiring within 3 days

**Current Implementation:**
- ✅ Recipe generation API with ingredient-based suggestions
- ✅ Craving preference support for personalized recommendations
- ✅ Bilingual recipe generation (Thai/English)
- ✅ Expiration-aware recipe suggestions
- ✅ Azure OpenAI integration for recipe composition
- ✅ Chat interface for interactive cooking advice

## Tech Stack

### Frontend (React Native)
- **Framework:** React Native (Expo)
- **UI Components:** React Native built-in components
- **Icons:** Ionicons (@expo/vector-icons)
- **State Management:** React Context API
- **Language Support:** Custom LanguageContext for Thai/English
- **Camera:** Expo Camera for image capture
- **Environment Config:** Automatic environment detection (local/production)

### Backend (Node.js Microservices)
- **Architecture:** Microservices with Docker Compose
- **Runtime:** Node.js with Express.js
- **Database:** PostgreSQL with Sequelize ORM
- **Services:**
  - **Auth Service:** User authentication and Microsoft Entra ID integration
  - **Inventory Service:** Food inventory CRUD operations
  - **Recipe Service:** AI-powered recipe generation with Azure OpenAI
  - **OCR Service:** Image processing with Azure Document Intelligence
- **Containerization:** Docker containers for each microservice
- **File Upload:** Multer middleware for image processing
- **Environment:** Environment-based configuration

## Project Structure

```
ginraidee/
├── src/                            # React Native frontend
│   ├── components/
│   │   └── modals/
│   │       ├── AddItemModal.js      # Add new food items
│   │       ├── EditItemModal.js     # Edit existing items
│   │       ├── CalendarModal.js     # Calendar date picker
│   │       └── DateDetailModal.js   # View items by date
│   ├── screens/
│   │   ├── InventoryScreen.js       # Main inventory view
│   │   ├── RecipeScreen.js          # AI recipe chat
│   │   ├── CameraScreen.js          # OCR image capture
│   │   └── CategoryListScreen.js    # Category browsing
│   ├── context/
│   │   ├── LanguageContext.js       # Bilingual support
│   │   └── InventoryContext.js      # Inventory state management
│   ├── services/
│   │   ├── apiService.js            # Backend REST client
│   │   └── azureOpenAIService.js    # Azure OpenAI integration
│   ├── config/
│   │   └── environment.js           # Environment configuration
│   ├── constants/
│   │   └── foodCategories.js        # Food category definitions
│   └── styles/
│       ├── inventoryStyles.js       # Inventory styling
│       └── modalStyles.js           # Modal styling
├── services/                        # Microservices (Node.js)
│   ├── auth-service/                # Authentication service
│   │   ├── src/
│   │   │   ├── controllers/         # Auth controllers
│   │   │   ├── routes/              # Auth endpoints
│   │   │   ├── models/              # User models
│   │   │   ├── config/              # Database config
│   │   │   └── server.js            # Auth service entry
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── inventory-service/           # Inventory service
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── inventoryController.js
│   │   │   ├── routes/
│   │   │   │   └── inventory.js
│   │   │   ├── models/              # Inventory models
│   │   │   ├── config/              # Database config
│   │   │   └── server.js            # Inventory service entry
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── recipe-service/              # Recipe generation service
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── recipeController.js
│   │   │   ├── routes/
│   │   │   │   └── recipes.js
│   │   │   └── server.js            # Recipe service entry
│   │   ├── Dockerfile
│   │   └── package.json
│   └── ocr-service/                 # OCR processing service
│       ├── src/
│       │   ├── controllers/
│       │   │   └── ocrController.js
│       │   ├── routes/
│       │   │   └── ocr.js
│       │   └── server.js            # OCR service entry
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml               # Orchestrates all microservices
├── App.js                           # React Native entry point
├── package.json                     # Frontend dependencies
└── README.md                        # This file
```

## Development Roadmap

### Phase 1: Core Inventory Management ✅
- [x] Basic food item CRUD operations
- [x] Expiration date tracking
- [x] Category-based organization
- [x] Calendar view integration
- [x] Edit functionality with modal interface
- [x] Category-based browsing
- [x] Backend API with database persistence
- [ ] Delete functionality
- [ ] Search and filter options

### Phase 2: OCR Integration ✅
- [x] Camera integration
- [x] Product label scanning
- [x] Text recognition with Azure Document Intelligence
- [x] Thai language support for labels
- [x] Product name extraction (bilingual)
- [x] Expiry date parsing (Thai + numeric formats)
- [x] Weight/quantity parsing with decimal support
- [x] Backend OCR controller and routes
- [ ] Receipt scanning for bulk item entry
- [ ] Barcode recognition integration

### Phase 3: AI Recipe Assistant ✅
- [x] AI service integration (Azure OpenAI)
- [x] Recipe recommendation engine
- [x] Craving preference support
- [x] Bilingual recipe generation (Thai/English)
- [x] Expiration-based recipe prioritization
- [x] Chat interface for cooking advice
- [ ] Natural language conversation history
- [ ] Recipe rating and favorites system

### Phase 4: Advanced Features (Planned)
- [ ] Push notifications for expiring items
- [ ] Shopping list generation from recipes
- [ ] Usage statistics and waste reduction metrics
- [ ] Social sharing for recipes
- [ ] Bulk batch import capabilities
- [ ] Recipe customization and saved recipes
- [ ] Nutrition information tracking

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Docker and Docker Compose
- PostgreSQL database (or use Docker container)
- Azure OpenAI API credentials
- Azure Document Intelligence API credentials
- Expo CLI (for React Native development)

### Frontend Setup

```bash
# Install frontend dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start the development server
npx expo start
```

### Backend Setup (Microservices)

```bash
# Set up environment variables for each service
# Create .env files in each service directory:
# - services/auth-service/.env
# - services/inventory-service/.env
# - services/recipe-service/.env
# - services/ocr-service/.env

# Required environment variables:
# DATABASE_URL (PostgreSQL connection)
# AZURE_OPENAI_API_KEY (for recipe-service)
# AZURE_OPENAI_ENDPOINT (for recipe-service)
# AZURE_OPENAI_DEPLOYMENT_NAME (for recipe-service)
# AZURE_DOCUMENT_INTELLIGENCE_KEY (for ocr-service)
# AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT (for ocr-service)

# Start all microservices with Docker Compose
docker compose up -d

# View service logs
docker compose logs -f

# Stop all services
docker compose down
```

**Service Endpoints:**
- Auth Service: `http://localhost:3001`
- Inventory Service: `http://localhost:3002`
- Recipe Service: `http://localhost:3003`
- OCR Service: `http://localhost:3004`

### Environment Configuration

The application automatically detects the environment based on Expo's `__DEV__` flag:
- **Development (`__DEV__ = true`):** Uses local backend at `http://<localhost>/api`
- **Production (`__DEV__ = false`):** Uses Azure backend at `https://ginraidee-api.azurewebsites.net/api`

Edit [src/config/environment.js](./src/config/environment.js) to customize API endpoints.

### Authentication Configuration

The app uses **Microsoft Entra ID** for authentication, supporting both personal and work Microsoft accounts.

**Current Setup (Standard Entra ID):**
- Tenant: `/common` (multi-tenant)
- Supports: Personal Microsoft accounts (Outlook, Hotmail) + Work accounts (Office 365)

**Optional: Migrate to Entra External ID for:**
- ✅ Social login (Google, Facebook)
- ✅ Custom branding
- ✅ Advanced user management

See [ENTRA_EXTERNAL_ID_MIGRATION.md](./docs/ENTRA_EXTERNAL_ID_MIGRATION.md) for migration guide and [ENTRA_CONFIG_REFERENCE.md](./docs/ENTRA_CONFIG_REFERENCE.md) for configuration reference.

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for all platforms
eas build --platform all

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## *** Updated Architecture ***

### Migration to Microservices
The backend has been refactored from a monolithic architecture to a microservices-based architecture for better scalability, maintainability, and separation of concerns.

**Architecture Benefits:**
- **Service Isolation:** Each service handles a specific domain (auth, inventory, recipes, OCR)
- **Independent Scaling:** Services can be scaled independently based on load
- **Technology Flexibility:** Each service can use different tech stacks if needed
- **Fault Isolation:** Failures in one service don't cascade to others
- **Development Velocity:** Teams can work on services independently

**Service Communication:**
- REST API communication between services
- Each service has its own database schema (if needed)
- Services are containerized with Docker for consistent deployment
- Docker Compose orchestrates local development environment

**Service Breakdown:**
1. **Auth Service (Port 3001)** - Handles user authentication and Microsoft Entra ID integration
2. **Inventory Service (Port 3002)** - Manages food inventory CRUD operations
3. **Recipe Service (Port 3003)** - Generates AI-powered recipe suggestions
4. **OCR Service (Port 3004)** - Processes images and extracts product metadata

## Deployment

### Frontend (React Native)
- Deployed via Expo EAS to iOS App Store and Google Play Store
- GitHub Actions handles automated builds and deployment

### Backend (Microservices)
- **Current:** Docker Compose for local development
- **Production (Azure App Service):** Monolithic deployment still active
  - Uses web.config for Node.js startup configuration
  - See `.github/workflows` for CI/CD pipeline configuration
- **Future:** Microservices deployment to Azure Container Instances or AKS (Azure Kubernetes Service)

## Technologies Used

### Frontend
- **React Native** - Mobile framework
- **Expo** - Development and deployment platform
- **React Context API** - State management
- **Expo Camera** - Device camera access
- **Expo Vector Icons** - Icon library
- **AsyncStorage** - Local data persistence

### Backend
- **Express.js** - REST API framework
- **PostgreSQL** - Relational database
- **Sequelize** - ORM for database operations
- **Multer** - File upload middleware
- **Azure OpenAI** - Recipe generation AI
- **Azure Document Intelligence** - OCR service

### Cloud Services
- **Azure App Service** - Backend hosting
- **Azure Database for PostgreSQL** - Database hosting
- **Azure OpenAI** - Recipe suggestions
- **Azure Document Intelligence** - Text recognition
- **Expo EAS** - Mobile app distribution

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License
