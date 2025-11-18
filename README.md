# Ginraidee - Food Inventory Management App

A React Native Expo app for managing your food inventory with expiration tracking and AI-powered recipe suggestions.

## Objective

This app solves a common pain point: **food waste due to lack of ingredient tracking**. Many people waste food because they:
- Don't know what ingredients they have in their inventory
- Forget about items until they expire
- Lack inspiration for what to cook with available ingredients

Ginraidee helps you track your food inventory, get notified about expiring items, and receive AI-powered recipe suggestions based on what you have.

## Features

### 1. Food Inventory List (In Progress)
Track all your food items with comprehensive management features:
- Add items manually with name, category, quantity, and expiration date
- Visual categorization with emoji icons (fruits, vegetables, meat, dairy, etc.)
- Expiration status tracking with color-coded indicators:
  - 🔴 Red: Expired items
  - 🟠 Orange: Expires today
  - 🔵 Teal: Expires tomorrow
  - 🟢 Green: Fresh (3+ days)
- Calendar view to see items expiring on specific dates
- Quick date selection (today, tomorrow, 3 days, 1 week)
- Bilingual support (Thai/English)

**Current Implementation:**
- ✅ Add item modal with category selection
- ✅ Custom calendar date picker
- ✅ Date detail view showing items expiring on selected dates
- ✅ Expiration status calculation and color coding
- ✅ Multi-language support

### 2. OCR (Optical Character Recognition) (Not Started)
Planned feature to streamline inventory entry:
- Scan receipts to automatically add purchased items
- Detect expiration dates from product packaging
- Quick bulk entry of multiple items

**Planned Capabilities:**
- Receipt scanning and parsing
- Automatic item name extraction
- Date recognition for expiration tracking
- Multi-item batch import

### 3. Chat with AI (In Progress)
AI-powered cooking assistant to help you:
- Get recipe suggestions based on available ingredients
- Find creative ways to use items before they expire
- Receive cooking instructions and tips
- Plan meals efficiently to reduce waste

**Planned Features:**
- Natural language queries about recipes
- Ingredient-based recipe recommendations
- Expiration-aware meal planning
- Cooking tips and substitution suggestions

## Tech Stack

- **Framework:** React Native (Expo)
- **UI Components:** React Native built-in components
- **Icons:** Ionicons (@expo/vector-icons)
- **State Management:** React Context API
- **Language Support:** Custom LanguageContext for Thai/English

## Project Structure

```
ginraidee/
├── mobile-simple/          # Main React Native app
│   └── src/
│       ├── components/
│       │   └── modals/
│       │       ├── AddItemModal.js       # Add new food items
│       │       └── DateDetailModal.js    # View items by date
│       ├── context/
│       │   └── LanguageContext.js        # Bilingual support
│       ├── constants/
│       │   └── foodCategories.js         # Food category definitions
│       └── styles/
│           └── modalStyles.js            # Component styling
├── mobile/                 # Legacy/alternate version
└── services/              # Backend services (if applicable)
```

## Development Roadmap

### Phase 1: Core Inventory Management (Current)
- [x] Basic food item CRUD operations
- [x] Expiration date tracking
- [x] Category-based organization
- [x] Calendar view integration
- [ ] Edit and delete functionality
- [ ] Search and filter options
- [ ] Persistent storage (AsyncStorage/Database)

### Phase 2: OCR Integration
- [ ] Camera integration
- [ ] Receipt scanning
- [ ] Text recognition for item names
- [ ] Date parsing from images
- [ ] Batch item creation

### Phase 3: AI Chat Assistant
- [ ] AI service integration
- [ ] Recipe recommendation engine
- [ ] Natural language processing
- [ ] Meal planning suggestions
- [ ] Expiration-based prioritization

### Phase 4: Advanced Features
- [ ] Push notifications for expiring items
- [ ] Shopping list generation
- [ ] Usage statistics and waste reduction metrics
- [ ] Share recipes with friends
- [ ] Barcode scanning for quick entry

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Azure OpenAI credentials

# Start the development server
npx expo start
```

## CI/CD Setup

This project uses GitHub Actions and Expo EAS for continuous integration and deployment.

See [CI_CD_SETUP.md](./CI_CD_SETUP.md) for detailed setup instructions.

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for all platforms
eas build --platform all
```

## Technologies Used

- **React Native** - Mobile framework
- **Expo** - Development platform
- **Azure OpenAI** - AI recipe suggestions
- **AsyncStorage** - Local data persistence
- **React Context API** - State management
- **Expo Vector Icons** - Icon library

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License
