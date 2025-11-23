import React, { createContext, useState, useContext, useEffect } from 'react';
import APIService from '../services/apiService';

const InventoryContext = createContext();

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export const InventoryProvider = ({ children }) => {
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load inventory from backend on mount
  useEffect(() => {
    loadInventory();
  }, []);

  // Load inventory from backend API
  const loadInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await APIService.getInventory();
      setInventory(items || []);
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (newItem) => {
    try {
      const createdItem = await APIService.createInventoryItem(newItem);
      setInventory((prev) => [...prev, createdItem]);
      setError(null);
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err.message);
    }
  };

  const deleteItem = async (id) => {
    try {
      await APIService.deleteInventoryItem(id);
      setInventory((prev) => prev.filter((item) => item.id !== id));
      setError(null);
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.message);
    }
  };

  const deleteMultipleItems = async (ids) => {
    try {
      await Promise.all(ids.map(id => APIService.deleteInventoryItem(id)));
      setInventory((prev) => prev.filter((item) => !ids.includes(item.id)));
      setError(null);
    } catch (err) {
      console.error('Error deleting items:', err);
      setError(err.message);
    }
  };

  const updateItem = async (id, updates) => {
    try {
      const updatedItem = await APIService.updateInventoryItem(id, updates);
      setInventory((prev) =>
        prev.map((item) => (item.id === id ? updatedItem : item))
      );
      setError(null);
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err.message);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        setInventory,
        addItem,
        deleteItem,
        deleteMultipleItems,
        updateItem,
        loadInventory,
        isLoading,
        error,
        isConnected,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};
