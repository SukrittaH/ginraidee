import React, { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('th'); // 'th' for Thai, 'en' for English

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'th' ? 'en' : 'th'));
  };

  const getText = (thText, enText) => {
    return language === 'th' ? thText : enText;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, getText }}>
      {children}
    </LanguageContext.Provider>
  );
};
