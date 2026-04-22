const { faker } = require('@faker-js/faker');

/**
 * Generate fake InventoryItem data for testing
 * @param {Object} overrides - Optional fields to override
 * @returns {Object} InventoryItem data
 */
function createInventoryItem(overrides = {}) {

  const categories = ['dairy', 'meat', 'vegetable', 'fruit', 'grain', 'snack', 'beverage', 'condiment'];
  const units = ['kg', 'g', 'L', 'ml', 'piece', 'pack'];
  const emojis = ['🥛', '🥩', '🥕', '🍎', '🍞', '🍪', '🥤', '🧂'];
  const colors = ['#FFE5E5', '#E5F5FF', '#E5FFE5', '#FFF5E5', '#F5E5FF', '#FFE5F5'];

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    name: faker.commerce.productName(),
    category: faker.helpers.arrayElement(categories),
    quantity: parseFloat(faker.number.float({ min: 0.1, max: 10, fractionDigits: 2 })),
    unit: faker.helpers.arrayElement(units),
    expirationDate: faker.date.future(),
    emoji: faker.helpers.arrayElement(emojis),
    backgroundColor: faker.helpers.arrayElement(colors),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

/**
 * Generate multiple fake inventory items
 * @param {number} count - Number of items to generate
 * @param {Object} overrides - Optional fields to override for all items
 * @returns {Array<Object>} Array of inventory item data
 */
function createInventoryItems(count, overrides = {}) {
  return Array.from({ length: count }, () => createInventoryItem(overrides));
}

/**
 * Create inventory item expiring on a specific date
 * @param {Date|string} date - Expiration date
 * @param {Object} overrides - Optional fields to override
 * @returns {Object} InventoryItem data
 */
function createExpiringItem(date, overrides = {}) {
  return createInventoryItem({
    expirationDate: date,
    ...overrides,
  });
}

/**
 * Create inventory items expiring within N days
 * @param {number} count - Number of items to generate
 * @param {number} daysFromNow - Days from now to expire (0-N)
 * @param {Object} overrides - Optional fields to override
 * @returns {Array<Object>} Array of inventory item data
 */
function createExpiringSoonItems(count, daysFromNow = 3, overrides = {}) {
  return Array.from({ length: count }, () => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + faker.number.int({ min: 0, max: daysFromNow }));
    return createInventoryItem({
      expirationDate,
      ...overrides,
    });
  });
}

module.exports = {
  createInventoryItem,
  createInventoryItems,
  createExpiringItem,
  createExpiringSoonItems,
};
