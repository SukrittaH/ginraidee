// API Service for communicating with backend
// Configure the API base URL based on environment

// For development, update this to your machine's IP address or use .env
// Example for local development on emulator: http://10.0.2.2:3000/api (Android)
//                                 or http://localhost:3000/api (iOS simulator)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

// Storage for auth token (in production, use secure storage)
let authToken = null;

class APIService {
  // ===== AUTHENTICATION =====

  /**
   * Register a new user
   */
  static async register(email, password, name, language = 'en') {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token
      authToken = data.token;
      return data;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token
      authToken = data.token;
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Set auth token (for restoring session)
   */
  static setAuthToken(token) {
    authToken = token;
  }

  /**
   * Get current auth token
   */
  static getAuthToken() {
    return authToken;
  }

  /**
   * Logout user
   */
  static logout() {
    authToken = null;
  }

  // ===== INVENTORY =====

  /**
   * Get all inventory items
   */
  static async getInventory() {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create item');
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
      const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

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
      const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/inventory/expiring/soon`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/inventory/by-date/${date}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
  static async generateRecipe(ingredients) {
    try {
      const response = await fetch(`${API_BASE_URL}/recipes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients }),
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
      const response = await fetch(`${API_BASE_URL}/recipes/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
}

export default APIService;
