const recipeController = require('../../controllers/recipeController');

// Mock dependencies
jest.mock('../../config/azure', () => ({
  getClient: jest.fn(() => ({
    getChatCompletions: jest.fn(),
  })),
  azureConfig: {
    deploymentName: 'gpt-4-test',
  },
}));

jest.mock('../../services/inventoryClient', () => ({
  getExpiringSoon: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  logBusinessEvent: jest.fn(),
  logExternalCall: jest.fn(),
}));

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setAttribute: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      })),
    })),
  },
}));

const { getClient } = require('../../config/azure');
const inventoryClient = require('../../services/inventoryClient');

describe('Recipe Controller - Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockClient;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request and response objects
    mockReq = {
      body: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    // Mock Azure OpenAI client
    mockClient = {
      getChatCompletions: jest.fn(),
    };
    getClient.mockReturnValue(mockClient);
  });

  describe('suggestMenu()', () => {
    it('should return 400 when no ingredients provided', async () => {
      mockReq.body = {};

      await recipeController.suggestMenu(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ingredients are required',
      });
    });

    it('should return 400 when ingredients array is empty', async () => {
      mockReq.body = { ingredients: [] };

      await recipeController.suggestMenu(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ingredients are required',
      });
    });

    it('should call Azure OpenAI with Thai prompts when language is th', async () => {
      mockReq.body = {
        ingredients: ['chicken', 'rice'],
        language: 'th',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [
          {
            message: {
              content: '1. ข้าวมันไก่\n2. ข้าวผัดไก่\n3. ข้าวราดแกงไก่',
            },
          },
        ],
      });

      await recipeController.suggestMenu(mockReq, mockRes);

      expect(mockClient.getChatCompletions).toHaveBeenCalled();
      const call = mockClient.getChatCompletions.mock.calls[0];
      const messages = call[1];

      // Check that system prompt is in Thai
      expect(messages[0].content).toContain('คุณเป็นเชฟมืออาชีพ');
      expect(messages[0].content).toContain('ห้ามเขียนสูตร');

      // Check that user prompt is in Thai
      expect(messages[1].content).toContain('วัตถุดิบที่มี');

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          menu: expect.any(String),
          round: 1,
        }),
      });
    });

    it('should call Azure OpenAI with English prompts when language is en', async () => {
      mockReq.body = {
        ingredients: ['chicken', 'rice'],
        language: 'en',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [
          {
            message: {
              content: '1. Chicken Rice\n2. Fried Rice with Chicken\n3. Chicken Curry Rice',
            },
          },
        ],
      });

      await recipeController.suggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const messages = call[1];

      // Check that system prompt is in English
      expect(messages[0].content).toContain('You are a professional chef');
      expect(messages[0].content).toContain('no recipes');

      // Check that user prompt is in English
      expect(messages[1].content).toContain('Available ingredients');
    });

    it('should include craving context in prompts when provided', async () => {
      mockReq.body = {
        ingredients: ['chicken'],
        language: 'en',
        craving: 'something spicy for dinner',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Spicy Chicken' } }],
      });

      await recipeController.suggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const messages = call[1];

      expect(messages[0].content).toContain('something spicy for dinner');
      expect(messages[1].content).toContain('Craving');
    });

    it('should sanitize long input strings', async () => {
      const longCraving = 'a'.repeat(1000); // 1000 characters

      mockReq.body = {
        ingredients: ['chicken'],
        craving: longCraving,
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Chicken Soup' } }],
      });

      await recipeController.suggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const messages = call[1];

      // Should be truncated to 500 characters
      const cravingInPrompt = messages[1].content;
      expect(cravingInPrompt.length).toBeLessThanOrEqual(600); // Prompt + 500 char craving
    });

    it('should handle Azure OpenAI errors gracefully', async () => {
      mockReq.body = {
        ingredients: ['chicken'],
      };

      mockClient.getChatCompletions.mockRejectedValue(new Error('API error'));

      await recipeController.suggestMenu(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to suggest menu',
        message: 'API error',
      });
    });

    it('should format ingredients correctly for prompt', async () => {
      mockReq.body = {
        ingredients: [
          { name: 'chicken', quantity: 500, unit: 'g' },
          { name: 'rice', quantity: 2, unit: 'cups' },
          'garlic',
        ],
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Chicken Rice' } }],
      });

      await recipeController.suggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const userPrompt = call[1][1].content;

      expect(userPrompt).toContain('chicken (500 g)');
      expect(userPrompt).toContain('rice (2 cups)');
      expect(userPrompt).toContain('garlic');
    });
  });

  describe('resuggestMenu()', () => {
    it('should return 400 when no ingredients provided', async () => {
      mockReq.body = {};

      await recipeController.resuggestMenu(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ingredients are required',
      });
    });

    it('should include previous menus in prompt to avoid repetition', async () => {
      mockReq.body = {
        ingredients: ['chicken'],
        previousMenus: ['Chicken Soup', 'Fried Chicken'],
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Grilled Chicken' } }],
      });

      await recipeController.resuggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const userPrompt = call[1][1].content;

      expect(userPrompt).toContain('Chicken Soup');
      expect(userPrompt).toContain('Fried Chicken');
      expect(userPrompt).toContain('do NOT repeat');
    });

    it('should handle empty previousMenus array', async () => {
      mockReq.body = {
        ingredients: ['chicken'],
        previousMenus: [],
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Chicken Rice' } }],
      });

      await recipeController.resuggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const userPrompt = call[1][1].content;

      expect(userPrompt).toContain('none');
    });

    it('should maintain craving context in resuggestion', async () => {
      mockReq.body = {
        ingredients: ['chicken'],
        previousMenus: ['Chicken Soup'],
        craving: 'something healthy',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Grilled Chicken Salad' } }],
      });

      await recipeController.resuggestMenu(mockReq, mockRes);

      const call = mockClient.getChatCompletions.mock.calls[0];
      const systemPrompt = call[1][0].content;
      const userPrompt = call[1][1].content;

      expect(systemPrompt).toContain('something healthy');
      expect(userPrompt).toContain('Craving');
    });
  });

  describe('generateRecipe()', () => {
    it('should return 400 when no dish or craving provided', async () => {
      mockReq.body = { ingredients: ['chicken'] };

      await recipeController.generateRecipe(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Dish or craving required',
      });
    });

    it('should return 400 when no ingredients provided', async () => {
      mockReq.body = { dish: 'Chicken Rice' };

      await recipeController.generateRecipe(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ingredients are required',
      });
    });

    it('should generate recipe in Thai when language is th', async () => {
      mockReq.body = {
        dish: 'ข้าวมันไก่',
        ingredients: ['chicken', 'rice'],
        language: 'th',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [
          {
            message: {
              content: '🍽️ เมนู: ข้าวมันไก่\n\n🛒 วัตถุดิบ:\n- ไก่\n\n👨‍🍳 ขั้นตอน:\n1. ต้มไก่',
            },
          },
        ],
      });

      await recipeController.generateRecipe(mockReq, mockRes);

      expect(mockClient.getChatCompletions).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          recipe: expect.any(String),
        }),
      });
    });

    it('should return fallback recipe on API error', async () => {
      mockReq.body = {
        dish: 'Chicken Rice',
        ingredients: ['chicken', 'rice'],
      };

      mockClient.getChatCompletions.mockRejectedValue(new Error('API error'));

      await recipeController.generateRecipe(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          recipe: expect.any(String),
          dish: 'Chicken Rice',
        }),
      });
    });
  });

  describe('checkIntent()', () => {
    it('should return "other" intent when no message provided', async () => {
      mockReq.body = {};

      await recipeController.checkIntent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        intent: 'other',
      });
    });

    it('should classify food-related intent', async () => {
      mockReq.body = {
        message: 'I want to cook pasta',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'food',
            },
          },
        ],
      });

      await recipeController.checkIntent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        intent: 'food',
      });
    });

    it('should classify non-food-related intent', async () => {
      mockReq.body = {
        message: 'What is the weather today?',
      };

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'other',
            },
          },
        ],
      });

      await recipeController.checkIntent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        intent: 'other',
      });
    });
  });

  describe('suggestByInventory()', () => {
    it('should fetch expiring items from inventory service', async () => {
      mockReq.userId = 'test-user-123';
      mockReq.body = {};

      inventoryClient.getExpiringItems = jest.fn().mockResolvedValue([
        { name: 'chicken', quantity: 500, unit: 'g', expirationDate: '2024-12-31' },
        { name: 'rice', quantity: 2, unit: 'cups', expirationDate: '2024-12-31' },
      ]);

      mockClient.getChatCompletions.mockResolvedValue({
        choices: [{ message: { content: '1. Chicken Rice' } }],
      });

      await recipeController.suggestByInventory(mockReq, mockRes);

      expect(inventoryClient.getExpiringItems).toHaveBeenCalledWith('test-user-123', 3);
      expect(mockClient.getChatCompletions).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        expiringItems: expect.any(Array),
        suggestions: '1. Chicken Rice',
      });
    });

    it('should return success message when no items expiring', async () => {
      mockReq.userId = 'test-user-123';
      mockReq.body = { language: 'en' };

      inventoryClient.getExpiringItems = jest.fn().mockResolvedValue([]);

      await recipeController.suggestByInventory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'No expiring ingredients found',
      });
    });

    it('should handle inventory service errors', async () => {
      mockReq.userId = 'test-user-123';
      mockReq.body = {};

      inventoryClient.getExpiringItems = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      await recipeController.suggestByInventory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to suggest recipes',
        message: 'Service unavailable',
      });
    });
  });
});
