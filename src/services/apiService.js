// API Service for communicating with backend
// Uses environment configuration from src/config/environment.js
import config from '../config/environment';

// Extract microservice URLs from config
const INVENTORY_URL = config.INVENTORY_URL || config.API_BASE_URL;
const RECIPE_URL = config.RECIPE_URL || config.API_BASE_URL;
const OCR_URL = config.OCR_URL || config.API_BASE_URL;
const AUTH_URL = config.AUTH_URL || config.API_BASE_URL;

console.log('🔗 Microservice URLs:');
console.log('  Auth:', AUTH_URL);
console.log('  Inventory:', INVENTORY_URL);
console.log('  Recipe:', RECIPE_URL);
console.log('  OCR:', OCR_URL);

// Callback to get access token from AuthContext
let getAccessTokenFn = null;

class APIService {
  /**
   * Set the function to retrieve access token from AuthContext
   * Called by AuthProvider after MSAL initializes
   */
  static setGetAccessTokenFn(fn) {
    getAccessTokenFn = fn;
  }

  /**
   * Get Authorization headers with EntraID token
   */
  static async getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (getAccessTokenFn) {
      try {
        const token = await getAccessTokenFn();
        headers.Authorization = `Bearer ${token}`;
      } catch (err) {
        console.warn('Failed to get access token:', err.message);
        // Continue without token - server will return 401 if required
      }
    }

    return headers;
  }

  // ===== INVENTORY =====

  /**
   * Get all inventory items
   */
  static async getInventory() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch inventory');
      }

      return data.data;
    } catch (error) {
      console.error('Get inventory error:', error);
      throw error;
    }
  }

  /**
   * Get single inventory item
   */
  static async getInventoryItem(id) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory/${id}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch item');
      }

      return data.data;
    } catch (error) {
      console.error('Get item error:', error);
      throw error;
    }
  }

  /**
   * Create new inventory item
   */
  static async createInventoryItem(item) {
    try {
      console.log('📤 Sending item:', item);
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory`, {
        method: 'POST',
        headers,
        body: JSON.stringify(item),
      });

      const data = await response.json();
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || JSON.stringify(data) || 'Failed to create item');
      }

      return data.data;
    } catch (error) {
      console.error('Create item error:', error);
      throw error;
    }
  }

  /**
   * Update inventory item
   */
  static async updateInventoryItem(id, updates) {
    try {
      console.log('📤 Updating item:', id);
      console.log('📤 Updates:', updates);
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      console.log('📥 Update response status:', response.status);
      console.log('📥 Update response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update item');
      }

      return data.data;
    } catch (error) {
      console.error('Update item error:', error);
      throw error;
    }
  }

  /**
   * Delete inventory item
   */
  static async deleteInventoryItem(id) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory/${id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete item');
      }

      return data;
    } catch (error) {
      console.error('Delete item error:', error);
      throw error;
    }
  }

  /**
   * Get items expiring soon
   */
  static async getExpiringSoon() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory/expiring/soon`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch expiring items');
      }

      return data.data;
    } catch (error) {
      console.error('Get expiring items error:', error);
      throw error;
    }
  }

  /**
   * Get items by date
   */
  static async getInventoryByDate(date) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${INVENTORY_URL}/inventory/by-date/${date}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch items');
      }

      return data.data;
    } catch (error) {
      console.error('Get items by date error:', error);
      throw error;
    }
  }

  // ===== RECIPES =====

  /**
   * Generate recipe from ingredients
   */
  static async generateRecipe(ingredients, craving = '', language = 'en') {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${RECIPE_URL}/recipes/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ingredients, craving, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recipe');
      }

      return data.data;
    } catch (error) {
      console.error('Generate recipe error:', error);
      throw error;
    }
  }

  /**
   * Get recipe suggestions based on inventory
   */
  static async suggestRecipes() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${RECIPE_URL}/recipes/suggest`, {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recipe suggestions');
      }

      return data.data;
    } catch (error) {
      console.error('Suggest recipes error:', error);
      throw error;
    }
  }

  // ===== OCR =====

  /**
   * Process image with OCR to extract product information
   */
  static async processOCR(formData) {
    try {
      const token = getAccessTokenFn ? await getAccessTokenFn() : null;
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${OCR_URL}/ocr/parse`, {
        method: 'POST',
        headers,
        body: formData,
        // Note: Don't set Content-Type header, let the browser set it with boundary
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process image');
      }

      return data;
    } catch (error) {
      console.error('OCR error:', error);
      throw error;
    }
  }
}

export default APIService;
