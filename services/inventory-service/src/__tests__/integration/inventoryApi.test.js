// Set test database URL before importing database config
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ginraidee_test';

const supertest = require('supertest');
const { sequelize, connectDatabase } = require('../../config/database');
const { User, InventoryItem } = require('../../models');
const app = require('../../app');
const { generateTestToken } = require('../../../../shared/test/helpers/apiHelper');
const { createUser } = require('../../../../shared/test/factories/userFactory');
const { createInventoryItem, createExpiringItem, createExpiringSoonItems } = require('../../../../shared/test/factories/inventoryFactory');

describe('Inventory API - Integration Tests', () => {
  let testUser1;
  let testUser2;
  let token1;
  let token2;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();

    // Force sync to drop and recreate all tables
    // This ensures clean state for tests
    await sequelize.sync({ force: true });

    // Verify tables were created
    const [users] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Users'");
    const [items] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'InventoryItems'");

    if (users.length === 0 || items.length === 0) {
      throw new Error('Test tables not created properly');
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    // Delete in correct order due to foreign key constraints
    await InventoryItem.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test users
    const user1Data = createUser({
      entraIdUserId: 'test-user-1-entraid',
      email: 'user1@test.com',
      name: 'Test User 1',
    });
    const user2Data = createUser({
      entraIdUserId: 'test-user-2-entraid',
      email: 'user2@test.com',
      name: 'Test User 2',
    });

    testUser1 = await User.create(user1Data);
    testUser2 = await User.create(user2Data);

    // Generate JWT tokens for authentication
    token1 = generateTestToken({ userId: testUser1.id });
    token2 = generateTestToken({ userId: testUser2.id });
  });

  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });

  describe('POST /api/inventory - Create item', () => {
    it('should create inventory item with valid data', async () => {
      const itemData = {
        name: 'Fresh Milk',
        category: 'dairy',
        quantity: 2.5,
        unit: 'L',
        expirationDate: '2024-12-31',
        emoji: '🥛',
        backgroundColor: '#FFE5E5',
      };

      const response = await supertest(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .send(itemData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Fresh Milk',
        category: 'dairy',
        quantity: '2.50',
        unit: 'L',
        userId: testUser1.id,
      });
      expect(response.body.data.id).toBeDefined();
    });

    it('should require authentication', async () => {
      const itemData = {
        name: 'Test Item',
        category: 'fruit',
        quantity: 1,
        unit: 'piece',
        expirationDate: '2024-12-31',
      };

      await supertest(app)
        .post('/api/inventory')
        .send(itemData)
        .expect(401);
    });

    it('should associate item with authenticated user', async () => {
      const itemData = {
        name: 'User1 Item',
        category: 'vegetable',
        quantity: 3,
        unit: 'kg',
        expirationDate: '2024-12-31',
      };

      const response = await supertest(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.userId).toBe(testUser1.id);

      // Verify item is in database with correct userId
      const dbItem = await InventoryItem.findByPk(response.body.data.id);
      expect(dbItem.userId).toBe(testUser1.id);
    });
  });

  describe('GET /api/inventory - Get all items', () => {
    beforeEach(async () => {
      // Create items for user1
      await InventoryItem.bulkCreate([
        createInventoryItem({ userId: testUser1.id, name: 'User1 Item 1', expirationDate: '2024-12-01' }),
        createInventoryItem({ userId: testUser1.id, name: 'User1 Item 2', expirationDate: '2024-12-15' }),
        createInventoryItem({ userId: testUser1.id, name: 'User1 Item 3', expirationDate: '2024-12-31' }),
      ]);

      // Create items for user2
      await InventoryItem.bulkCreate([
        createInventoryItem({ userId: testUser2.id, name: 'User2 Item 1' }),
        createInventoryItem({ userId: testUser2.id, name: 'User2 Item 2' }),
      ]);
    });

    it('should return all items for authenticated user', async () => {
      const response = await supertest(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every(item => item.userId === testUser1.id)).toBe(true);
    });

    it('should return items ordered by expiration date ascending', async () => {
      const response = await supertest(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const dates = response.body.data.map(item => item.expirationDate);
      expect(dates).toEqual(['2024-12-01', '2024-12-15', '2024-12-31']);
    });

    it('should not return items from other users', async () => {
      const response = await supertest(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const hasUser2Items = response.body.data.some(item => item.userId === testUser2.id);
      expect(hasUser2Items).toBe(false);
    });

    it('should return empty array when user has no items', async () => {
      // Clean up all items
      await InventoryItem.destroy({ where: {}, truncate: true });

      const response = await supertest(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should require authentication', async () => {
      await supertest(app)
        .get('/api/inventory')
        .expect(401);
    });
  });

  describe('GET /api/inventory/:id - Get single item', () => {
    let item1;
    let item2;

    beforeEach(async () => {
      item1 = await InventoryItem.create(
        createInventoryItem({ userId: testUser1.id, name: 'User1 Item' })
      );
      item2 = await InventoryItem.create(
        createInventoryItem({ userId: testUser2.id, name: 'User2 Item' })
      );
    });

    it('should return single item by ID', async () => {
      const response = await supertest(app)
        .get(`/api/inventory/${item1.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(item1.id);
      expect(response.body.data.name).toBe('User1 Item');
    });

    it('should return 404 when item not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await supertest(app)
        .get(`/api/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should not return items from other users', async () => {
      // User1 trying to access User2's item
      const response = await supertest(app)
        .get(`/api/inventory/${item2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should require authentication', async () => {
      await supertest(app)
        .get(`/api/inventory/${item1.id}`)
        .expect(401);
    });
  });

  describe('PUT /api/inventory/:id - Update item', () => {
    let item1;
    let item2;

    beforeEach(async () => {
      item1 = await InventoryItem.create(
        createInventoryItem({ userId: testUser1.id, name: 'Original Name', quantity: 1 })
      );
      item2 = await InventoryItem.create(
        createInventoryItem({ userId: testUser2.id, name: 'User2 Item' })
      );
    });

    it('should update item with new data', async () => {
      const updateData = {
        name: 'Updated Name',
        quantity: 5,
        unit: 'kg',
      };

      const response = await supertest(app)
        .put(`/api/inventory/${item1.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.quantity).toBe('5.00');
      expect(response.body.data.unit).toBe('kg');
    });

    it('should persist changes to database', async () => {
      await supertest(app)
        .put(`/api/inventory/${item1.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'New Name' })
        .expect(200);

      const updatedItem = await InventoryItem.findByPk(item1.id);
      expect(updatedItem.name).toBe('New Name');
    });

    it('should return 404 when item not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await supertest(app)
        .put(`/api/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should not update items from other users', async () => {
      // User1 trying to update User2's item
      const response = await supertest(app)
        .put(`/api/inventory/${item2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(response.body.error).toBe('Item not found');

      // Verify item was not modified
      const unchangedItem = await InventoryItem.findByPk(item2.id);
      expect(unchangedItem.name).toBe('User2 Item');
    });

    it('should require authentication', async () => {
      await supertest(app)
        .put(`/api/inventory/${item1.id}`)
        .send({ name: 'New Name' })
        .expect(401);
    });
  });

  describe('DELETE /api/inventory/:id - Delete item', () => {
    let item1;
    let item2;

    beforeEach(async () => {
      item1 = await InventoryItem.create(
        createInventoryItem({ userId: testUser1.id, name: 'User1 Item' })
      );
      item2 = await InventoryItem.create(
        createInventoryItem({ userId: testUser2.id, name: 'User2 Item' })
      );
    });

    it('should delete item', async () => {
      const response = await supertest(app)
        .delete(`/api/inventory/${item1.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Item deleted');

      // Verify item is deleted from database
      const deletedItem = await InventoryItem.findByPk(item1.id);
      expect(deletedItem).toBeNull();
    });

    it('should return 404 when item not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await supertest(app)
        .delete(`/api/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should not delete items from other users', async () => {
      // User1 trying to delete User2's item
      const response = await supertest(app)
        .delete(`/api/inventory/${item2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);

      expect(response.body.error).toBe('Item not found');

      // Verify item still exists
      const stillExists = await InventoryItem.findByPk(item2.id);
      expect(stillExists).not.toBeNull();
    });

    it('should require authentication', async () => {
      await supertest(app)
        .delete(`/api/inventory/${item1.id}`)
        .expect(401);
    });
  });

  describe('GET /api/inventory/expiring/soon - Get items expiring within 3 days', () => {
    beforeEach(async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const twoDays = new Date(today);
      twoDays.setDate(twoDays.getDate() + 2);
      const fourDays = new Date(today);
      fourDays.setDate(fourDays.getDate() + 4);

      // Create items with different expiration dates
      await InventoryItem.bulkCreate([
        createExpiringItem(today.toISOString().split('T')[0], { userId: testUser1.id, name: 'Expires today' }),
        createExpiringItem(tomorrow.toISOString().split('T')[0], { userId: testUser1.id, name: 'Expires tomorrow' }),
        createExpiringItem(twoDays.toISOString().split('T')[0], { userId: testUser1.id, name: 'Expires in 2 days' }),
        createExpiringItem(fourDays.toISOString().split('T')[0], { userId: testUser1.id, name: 'Expires in 4 days' }),
      ]);
    });

    it('should return items expiring within 3 days', async () => {
      const response = await supertest(app)
        .get('/api/inventory/expiring/soon')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);

      const names = response.body.data.map(item => item.name);
      expect(names).toContain('Expires today');
      expect(names).toContain('Expires tomorrow');
      expect(names).toContain('Expires in 2 days');
      expect(names).not.toContain('Expires in 4 days');
    });

    it('should return items ordered by expiration date', async () => {
      const response = await supertest(app)
        .get('/api/inventory/expiring/soon')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const dates = response.body.data.map(item => new Date(item.expirationDate).getTime());

      // Check dates are in ascending order
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('should return empty array when no items expiring soon', async () => {
      // Clean up all items
      await InventoryItem.destroy({ where: {}, truncate: true });

      const response = await supertest(app)
        .get('/api/inventory/expiring/soon')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should not return items from other users', async () => {
      const today = new Date();

      await InventoryItem.create(
        createExpiringItem(today.toISOString().split('T')[0], {
          userId: testUser2.id,
          name: 'User2 expiring item',
        })
      );

      const response = await supertest(app)
        .get('/api/inventory/expiring/soon')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const hasUser2Items = response.body.data.some(item => item.userId === testUser2.id);
      expect(hasUser2Items).toBe(false);
    });

    it('should require authentication', async () => {
      await supertest(app)
        .get('/api/inventory/expiring/soon')
        .expect(401);
    });
  });

  describe('GET /api/inventory/by-date/:date - Get items by specific date', () => {
    beforeEach(async () => {
      await InventoryItem.bulkCreate([
        createExpiringItem('2024-12-31', { userId: testUser1.id, name: 'Item 1' }),
        createExpiringItem('2024-12-31', { userId: testUser1.id, name: 'Item 2' }),
        createExpiringItem('2025-01-01', { userId: testUser1.id, name: 'Item 3' }),
        createExpiringItem('2024-12-31', { userId: testUser2.id, name: 'User2 Item' }),
      ]);
    });

    it('should return items expiring on specific date', async () => {
      const response = await supertest(app)
        .get('/api/inventory/by-date/2024-12-31')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every(item => item.expirationDate === '2024-12-31')).toBe(true);
    });

    it('should return empty array when no items on date', async () => {
      const response = await supertest(app)
        .get('/api/inventory/by-date/2099-01-01')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should not return items from other users', async () => {
      const response = await supertest(app)
        .get('/api/inventory/by-date/2024-12-31')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const hasUser2Items = response.body.data.some(item => item.userId === testUser2.id);
      expect(hasUser2Items).toBe(false);
    });

    it('should require authentication', async () => {
      await supertest(app)
        .get('/api/inventory/by-date/2024-12-31')
        .expect(401);
    });
  });
});
