import React, { createContext, useState, useContext } from 'react';
import { MOCK_INVENTORY } from '../constants/mockData';

const InventoryContext = createContext();

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export const InventoryProvider = ({ children }) => {
  const [inventory, setInventory] = useState(MOCK_INVENTORY);

  const addItem = (newItem) => {
    setInventory((prev) => [...prev, newItem]);
  };

  const deleteItem = (id) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  const deleteMultipleItems = (ids) => {
    setInventory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const updateItem = (id, updates) => {
    setInventory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
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
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};
