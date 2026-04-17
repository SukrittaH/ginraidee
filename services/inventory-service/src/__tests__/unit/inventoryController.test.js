const { Op } = require('sequelize');
const inventoryController = require('../../controllers/inventoryController');
const { InventoryItem } = require('../../models');
const { createInventoryItem } = require('../../../../shared/test/factories/inventoryFactory');

// Mock dependencies
jest.mock('../../models', () => ({
  InventoryItem: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  User: {},
}));

jest.mock('../../config/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  logBusinessEvent: jest.fn(),
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

describe('Inventory Controller - Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request and response objects
    mockReq = {
      userId: 'test-user-id',
      params: {},
      body: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getAll()', () => {
    it('should fetch all items for authenticated user', async () => {
      const mockItems = [
        createInventoryItem({ userId: 'test-user-id' }),
        createInventoryItem({ userId: 'test-user-id' }),
      ];

      InventoryItem.findAll.mockResolvedValue(mockItems);

      await inventoryController.getAll(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        order: [['expirationDate', 'ASC']],
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
      });
    });

    it('should return empty array when no items found', async () => {
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getAll(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database errors', async () => {
      InventoryItem.findAll.mockRejectedValue(new Error('Database error'));

      await inventoryController.getAll(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch inventory',
      });
    });

    it('should scope query to authenticated user only', async () => {
      const differentUserId = 'different-user-id';
      mockReq.userId = differentUserId;

      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getAll(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: differentUserId },
        })
      );
    });
  });

  describe('getById()', () => {
    it('should fetch single item by ID for authenticated user', async () => {
      const mockItem = createInventoryItem({ userId: 'test-user-id' });
      mockReq.params.id = mockItem.id;

      InventoryItem.findOne.mockResolvedValue(mockItem);

      await inventoryController.getById(mockReq, mockRes);

      expect(InventoryItem.findOne).toHaveBeenCalledWith({
        where: {
          id: mockItem.id,
          userId: 'test-user-id',
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem,
      });
    });

    it('should return 404 when item not found', async () => {
      mockReq.params.id = 'non-existent-id';
      InventoryItem.findOne.mockResolvedValue(null);

      await inventoryController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Item not found',
      });
    });

    it('should not return items from different user', async () => {
      mockReq.params.id = 'some-item-id';
      InventoryItem.findOne.mockResolvedValue(null);

      await inventoryController.getById(mockReq, mockRes);

      expect(InventoryItem.findOne).toHaveBeenCalledWith({
        where: {
          id: 'some-item-id',
          userId: 'test-user-id',
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle database errors', async () => {
      mockReq.params.id = 'some-id';
      InventoryItem.findOne.mockRejectedValue(new Error('Database error'));

      await inventoryController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch item',
      });
    });
  });

  describe('create()', () => {
    it('should create new inventory item with user ID', async () => {
      const itemData = {
        name: 'Test Item',
        category: 'dairy',
        quantity: 2.5,
        unit: 'kg',
        expirationDate: '2024-12-31',
      };
      mockReq.body = itemData;

      const mockCreatedItem = createInventoryItem({
        ...itemData,
        userId: 'test-user-id',
      });

      InventoryItem.create.mockResolvedValue(mockCreatedItem);

      await inventoryController.create(mockReq, mockRes);

      expect(InventoryItem.create).toHaveBeenCalledWith({
        ...itemData,
        userId: 'test-user-id',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedItem,
      });
    });

    it('should handle creation errors', async () => {
      mockReq.body = { name: 'Test' };
      InventoryItem.create.mockRejectedValue(new Error('Validation error'));

      await inventoryController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to create item',
      });
    });

    it('should always associate item with authenticated user', async () => {
      mockReq.body = { name: 'Test', category: 'fruit' };
      mockReq.userId = 'specific-user-id';

      InventoryItem.create.mockResolvedValue({});

      await inventoryController.create(mockReq, mockRes);

      expect(InventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'specific-user-id',
        })
      );
    });
  });

  describe('update()', () => {
    it('should update existing item for authenticated user', async () => {
      const updateData = { name: 'Updated Name', quantity: 5 };
      mockReq.params.id = 'item-id';
      mockReq.body = updateData;

      const updatedItem = createInventoryItem({
        id: 'item-id',
        ...updateData,
        userId: 'test-user-id',
      });

      InventoryItem.update.mockResolvedValue([1]); // 1 row updated
      InventoryItem.findByPk.mockResolvedValue(updatedItem);

      await inventoryController.update(mockReq, mockRes);

      expect(InventoryItem.update).toHaveBeenCalledWith(updateData, {
        where: {
          id: 'item-id',
          userId: 'test-user-id',
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedItem,
      });
    });

    it('should return 404 when item not found', async () => {
      mockReq.params.id = 'non-existent-id';
      mockReq.body = { name: 'New Name' };

      InventoryItem.update.mockResolvedValue([0]); // 0 rows updated

      await inventoryController.update(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Item not found',
      });
    });

    it('should not update items from different user', async () => {
      mockReq.params.id = 'item-id';
      mockReq.body = { name: 'Hacked Name' };
      mockReq.userId = 'attacker-user-id';

      InventoryItem.update.mockResolvedValue([0]);

      await inventoryController.update(mockReq, mockRes);

      expect(InventoryItem.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'attacker-user-id',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle update errors', async () => {
      mockReq.params.id = 'item-id';
      mockReq.body = { name: 'New' };

      InventoryItem.update.mockRejectedValue(new Error('Database error'));

      await inventoryController.update(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to update item',
      });
    });
  });

  describe('delete()', () => {
    it('should delete item for authenticated user', async () => {
      mockReq.params.id = 'item-id';

      InventoryItem.destroy.mockResolvedValue(1); // 1 row deleted

      await inventoryController.delete(mockReq, mockRes);

      expect(InventoryItem.destroy).toHaveBeenCalledWith({
        where: {
          id: 'item-id',
          userId: 'test-user-id',
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item deleted',
      });
    });

    it('should return 404 when item not found', async () => {
      mockReq.params.id = 'non-existent-id';

      InventoryItem.destroy.mockResolvedValue(0); // 0 rows deleted

      await inventoryController.delete(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Item not found',
      });
    });

    it('should not delete items from different user', async () => {
      mockReq.params.id = 'item-id';
      mockReq.userId = 'other-user-id';

      InventoryItem.destroy.mockResolvedValue(0);

      await inventoryController.delete(mockReq, mockRes);

      expect(InventoryItem.destroy).toHaveBeenCalledWith({
        where: {
          id: 'item-id',
          userId: 'other-user-id',
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle deletion errors', async () => {
      mockReq.params.id = 'item-id';

      InventoryItem.destroy.mockRejectedValue(new Error('Database error'));

      await inventoryController.delete(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to delete item',
      });
    });
  });

  describe('getExpiringSoon()', () => {
    it('should fetch items expiring within 3 days', async () => {
      const mockItems = [
        createInventoryItem({ userId: 'test-user-id', expirationDate: new Date() }),
        createInventoryItem({ userId: 'test-user-id', expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) }),
      ];

      InventoryItem.findAll.mockResolvedValue(mockItems);

      await inventoryController.getExpiringSoon(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          expirationDate: {
            [Op.gte]: expect.any(String),
            [Op.lte]: expect.any(String),
          },
        },
        order: [['expirationDate', 'ASC']],
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
      });
    });

    it('should return empty array when no items expiring', async () => {
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getExpiringSoon(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should calculate 3-day window correctly', async () => {
      InventoryItem.findAll.mockResolvedValue([]);

      const today = new Date();
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      await inventoryController.getExpiringSoon(mockReq, mockRes);

      const callArgs = InventoryItem.findAll.mock.calls[0][0];
      const gteDateArg = callArgs.where.expirationDate[Op.gte];
      const lteDateArg = callArgs.where.expirationDate[Op.lte];

      // Check that dates are strings in YYYY-MM-DD format
      expect(typeof gteDateArg).toBe('string');
      expect(typeof lteDateArg).toBe('string');
      expect(gteDateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(lteDateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check that the range is correct (today to 2 days from now)
      const todayStr = today.toISOString().split('T')[0];
      const twoDaysStr = twoDaysFromNow.toISOString().split('T')[0];
      expect(gteDateArg).toBe(todayStr);
      expect(lteDateArg).toBe(twoDaysStr);
    });

    it('should scope query to authenticated user', async () => {
      mockReq.userId = 'specific-user-id';
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getExpiringSoon(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'specific-user-id',
          }),
        })
      );
    });

    it('should handle errors', async () => {
      InventoryItem.findAll.mockRejectedValue(new Error('Database error'));

      await inventoryController.getExpiringSoon(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch expiring items',
      });
    });
  });

  describe('getByDate()', () => {
    it('should fetch items expiring on specific date', async () => {
      const targetDate = '2024-12-31';
      mockReq.params.date = targetDate;

      const mockItems = [
        createInventoryItem({ userId: 'test-user-id', expirationDate: targetDate }),
      ];

      InventoryItem.findAll.mockResolvedValue(mockItems);

      await inventoryController.getByDate(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          expirationDate: targetDate,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
      });
    });

    it('should return empty array when no items on date', async () => {
      mockReq.params.date = '2025-01-01';
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getByDate(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should use exact date matching', async () => {
      const exactDate = '2024-06-15';
      mockReq.params.date = exactDate;
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getByDate(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          expirationDate: exactDate,
        },
      });
    });

    it('should scope query to authenticated user', async () => {
      mockReq.params.date = '2024-12-31';
      mockReq.userId = 'different-user-id';
      InventoryItem.findAll.mockResolvedValue([]);

      await inventoryController.getByDate(mockReq, mockRes);

      expect(InventoryItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'different-user-id',
          }),
        })
      );
    });

    it('should handle errors', async () => {
      mockReq.params.date = '2024-12-31';
      InventoryItem.findAll.mockRejectedValue(new Error('Database error'));

      await inventoryController.getByDate(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch items',
      });
    });
  });
});
