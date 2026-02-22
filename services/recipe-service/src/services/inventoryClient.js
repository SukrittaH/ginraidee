const axios = require('axios');

/**
 * Inventory Service HTTP Client
 * Calls the Inventory Service API to fetch inventory data
 *
 * This replaces direct database queries, allowing Recipe Service
 * to be completely independent of the database.
 */

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL ||
  'http://inventory-service.ginraidee.svc.cluster.local:3002';

class InventoryClient {
  /**
   * Get expiring items for a user
   * Calls: GET /internal/inventory/user/:userId/expiring?days=3
   *
   * @param {string} userId - The user ID
   * @param {number} days - Number of days to check (default: 3)
   * @returns {Promise<Array>} Array of expiring inventory items
   */
  async getExpiringItems(userId, days = 3) {
    try {
      const response = await axios.get(
        `${INVENTORY_SERVICE_URL}/internal/inventory/user/${userId}/expiring`,
        {
          params: { days },
          timeout: 5000, // 5 second timeout
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch expiring items from Inventory Service:', error.message);

      // Return empty array instead of crashing
      // Frontend will display "No expiring items found"
      return [];
    }
  }

  /**
   * Get all inventory items for a user
   * Calls: GET /internal/inventory/user/:userId
   *
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of all inventory items
   */
  async getUserInventory(userId) {
    try {
      const response = await axios.get(
        `${INVENTORY_SERVICE_URL}/internal/inventory/user/${userId}`,
        {
          timeout: 5000, // 5 second timeout
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch user inventory from Inventory Service:', error.message);
      return [];
    }
  }
}

module.exports = new InventoryClient();
