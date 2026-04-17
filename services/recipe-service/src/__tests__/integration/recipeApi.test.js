// Set test environment variables BEFORE requiring any modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.AZURE_OPENAI_ENDPOINT = 'https://test-openai.openai.azure.com';
process.env.AZURE_OPENAI_API_KEY = 'test-key';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4-test';
process.env.INVENTORY_SERVICE_URL = 'http://localhost:3002';

const supertest = require('supertest');
const app = require('../../app');
const { generateTestToken } = require('../../../../shared/test/helpers/apiHelper');
const {
  mockMenuSuggestion,
  mockRecipeGeneration,
  mockIntentClassification,
  mockOpenAIError,
  clearMocks,
} = require('../../../../shared/test/mocks/azureOpenAIMock');
const {
  mockExpiringItems,
  mockNoExpiringItems,
  mockInventoryError,
} = require('../../../../shared/test/mocks/inventoryServiceMock');

describe('Recipe API - Integration Tests', () => {
  let testToken;

  beforeAll(() => {
    // Generate test JWT token
    testToken = generateTestToken({ userId: 'test-user-123' });
  });

  afterEach(() => {
    // Clear all nock mocks after each test
    clearMocks();
  });

  describe('POST /api/recipes/suggest-menu - Menu suggestions', () => {
    it('should suggest menu with valid ingredients', async () => {
      const menuText = '1. Chicken Fried Rice\n2. Chicken Soup\n3. Grilled Chicken';
      mockMenuSuggestion(menuText);

      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken', 'rice', 'garlic'],
          language: 'en',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.menu).toBe(menuText);
      expect(response.body.data.round).toBe(1);
    });

    it('should suggest menu in Thai when language is th', async () => {
      const menuText = '1. ข้าวผัดไก่\n2. ข้าวต้มไก่\n3. ไก่ย่าง';
      mockMenuSuggestion(menuText);

      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['ไก่', 'ข้าว'],
          language: 'th',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.menu).toContain('ข้าว');
    });

    it('should include craving context in suggestions', async () => {
      const menuText = '1. Spicy Chicken Curry\n2. Spicy Chicken Stir-fry\n3. Spicy Chicken Wings';
      mockMenuSuggestion(menuText);

      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken'],
          language: 'en',
          craving: 'something spicy for dinner',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.menu).toContain('Spicy');
    });

    it('should return 400 when no ingredients provided', async () => {
      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Ingredients are required');
    });

    it('should return 401 when no authentication token', async () => {
      await supertest(app)
        .post('/api/recipes/suggest-menu')
        .send({
          ingredients: ['chicken'],
        })
        .expect(401);
    });

    it('should handle Azure OpenAI errors', async () => {
      clearMocks(); // Clear previous mocks first
      mockOpenAIError(500, 'Service temporarily unavailable');

      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken'],
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to suggest menu');
    });

    it('should handle structured ingredient objects', async () => {
      clearMocks(); // Clear previous mocks first
      mockMenuSuggestion('1. Chicken Rice Bowl');

      const response = await supertest(app)
        .post('/api/recipes/suggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: [
            { name: 'chicken', quantity: 500, unit: 'g' },
            { name: 'rice', quantity: 2, unit: 'cups' },
          ],
          language: 'en',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/recipes/resuggest-menu - Alternative menu suggestions', () => {
    it('should suggest different menus from previous ones', async () => {
      clearMocks(); // Clear previous mocks first
      const newMenuText = '1. Chicken Satay\n2. Chicken Teriyaki\n3. Chicken Alfredo';
      mockMenuSuggestion(newMenuText);

      const response = await supertest(app)
        .post('/api/recipes/resuggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken', 'rice'],
          previousMenus: ['Chicken Soup', 'Fried Chicken'],
          language: 'en',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.menu).toBe(newMenuText);
      expect(response.body.data.round).toBe(2);
    });

    it('should maintain craving context in resuggestions', async () => {
      clearMocks(); // Clear previous mocks first
      mockMenuSuggestion('1. Healthy Grilled Chicken');

      const response = await supertest(app)
        .post('/api/recipes/resuggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken'],
          previousMenus: ['Fried Chicken'],
          craving: 'something healthy',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle empty previous menus array', async () => {
      clearMocks(); // Clear previous mocks first
      mockMenuSuggestion('1. Chicken Rice');

      const response = await supertest(app)
        .post('/api/recipes/resuggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken'],
          previousMenus: [],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 when no ingredients provided', async () => {
      const response = await supertest(app)
        .post('/api/recipes/resuggest-menu')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          previousMenus: ['Chicken Soup'],
        })
        .expect(400);

      expect(response.body.error).toBe('Ingredients are required');
    });

    it('should require authentication', async () => {
      await supertest(app)
        .post('/api/recipes/resuggest-menu')
        .send({
          ingredients: ['chicken'],
        })
        .expect(401);
    });
  });

  describe('POST /api/recipes/generate - Full recipe generation', () => {
    it('should generate full recipe with steps', async () => {
      clearMocks(); // Clear previous mocks first
      const recipeText = '## Chicken Fried Rice\n\n**Ingredients:**\n- Chicken\n- Rice\n\n**Steps:**\n1. Cook rice\n2. Fry chicken\n3. Mix together';
      mockRecipeGeneration(recipeText);

      const response = await supertest(app)
        .post('/api/recipes/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dish: 'Chicken Fried Rice',
          ingredients: ['chicken', 'rice'],
          language: 'en',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recipe).toContain('Chicken Fried Rice');
      expect(response.body.data.recipe).toContain('Steps:');
    });

    it('should generate recipe in Thai when language is th', async () => {
      clearMocks(); // Clear previous mocks first
      const recipeText = '## ข้าวผัดไก่\n\n**วัตถุดิบ:**\n- ไก่\n\n**ขั้นตอน:**\n1. ต้มข้าว';
      mockRecipeGeneration(recipeText);

      const response = await supertest(app)
        .post('/api/recipes/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dish: 'ข้าวผัดไก่',
          ingredients: ['ไก่', 'ข้าว'],
          language: 'th',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recipe).toContain('วัตถุดิบ');
      expect(response.body.data.recipe).toContain('ขั้นตอน');
    });

    it('should return 400 when no dish or craving provided', async () => {
      const response = await supertest(app)
        .post('/api/recipes/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          ingredients: ['chicken'],
        })
        .expect(400);

      expect(response.body.error).toBe('Dish or craving required');
    });

    it('should return 400 when no ingredients provided', async () => {
      const response = await supertest(app)
        .post('/api/recipes/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dish: 'Chicken Rice',
        })
        .expect(400);

      expect(response.body.error).toBe('Ingredients are required');
    });

    it('should return fallback recipe when API fails', async () => {
      clearMocks(); // Clear previous mocks first
      mockOpenAIError(500);

      const response = await supertest(app)
        .post('/api/recipes/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dish: 'Chicken Rice',
          ingredients: ['chicken', 'rice'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recipe).toContain('Chicken Rice');
      // Fallback recipe doesn't have warning field
    });

    it('should require authentication', async () => {
      await supertest(app)
        .post('/api/recipes/generate')
        .send({
          menuName: 'Chicken Rice',
          ingredients: ['chicken'],
        })
        .expect(401);
    });
  });

  describe('POST /api/recipes/suggest - Suggest from expiring items', () => {
    it('should suggest recipes from expiring inventory items', async () => {
      clearMocks(); // Clear previous mocks first
      mockExpiringItems(3);
      mockMenuSuggestion('1. Item Soup\n2. Item Stir-fry\n3. Item Salad');

      const response = await supertest(app)
        .post('/api/recipes/suggest')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.expiringItems).toHaveLength(3);
    });

    it('should return success message when no items expiring', async () => {
      clearMocks(); // Clear previous mocks first
      mockNoExpiringItems();

      const response = await supertest(app)
        .post('/api/recipes/suggest')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('No expiring ingredients found');
    });

    it('should handle inventory service errors gracefully', async () => {
      clearMocks(); // Clear previous mocks first
      mockInventoryError(500);

      // The inventoryClient catches errors and returns [], so we get success with no items
      const response = await supertest(app)
        .post('/api/recipes/suggest')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('No expiring ingredients found');
    });

    it('should require authentication', async () => {
      await supertest(app)
        .post('/api/recipes/suggest')
        .send({})
        .expect(401);
    });
  });

  describe('POST /api/recipes/check-intent - Intent classification', () => {
    it('should classify food-related intent', async () => {
      clearMocks(); // Clear previous mocks first
      mockIntentClassification('food');

      const response = await supertest(app)
        .post('/api/recipes/check-intent')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          message: 'I want to cook pasta with tomato sauce',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.intent).toBe('food');
    });

    it('should classify non-food-related intent', async () => {
      clearMocks(); // Clear previous mocks first
      mockIntentClassification('other');

      const response = await supertest(app)
        .post('/api/recipes/check-intent')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          message: 'What is the weather today?',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.intent).toBe('other');
    });

    it('should return other intent when no message provided', async () => {
      const response = await supertest(app)
        .post('/api/recipes/check-intent')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.intent).toBe('other');
    });

    it('should require authentication', async () => {
      await supertest(app)
        .post('/api/recipes/check-intent')
        .send({
          message: 'test message',
        })
        .expect(401);
    });
  });
});
