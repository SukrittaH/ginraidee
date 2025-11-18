// Universal unit list for all ingredients
export const UNITS = [
  { value: 'kg', labelTh: 'กิโลกรัม (kg)', labelEn: 'Kilogram (kg)' },
  { value: 'g', labelTh: 'กรัม (g)', labelEn: 'Gram (g)' },
  { value: 'mg', labelTh: 'มิลลิกรัม (mg)', labelEn: 'Milligram (mg)' },
  { value: 'L', labelTh: 'ลิตร (L)', labelEn: 'Liter (L)' },
  { value: 'mL', labelTh: 'มิลลิลิตร (mL)', labelEn: 'Milliliter (mL)' },
  { value: 'cup', labelTh: 'ถ้วย', labelEn: 'Cup' },
  { value: 'tbsp', labelTh: 'ช้อนโต๊ะ', labelEn: 'Tablespoon' },
  { value: 'tsp', labelTh: 'ช้อนชา', labelEn: 'Teaspoon' },
  { value: 'pcs', labelTh: 'ชิ้น', labelEn: 'Pieces' },
  { value: 'pack', labelTh: 'แพ็ค', labelEn: 'Pack' },
  { value: 'bag', labelTh: 'ถุง', labelEn: 'Bag' },
  { value: 'box', labelTh: 'กล่อง', labelEn: 'Box' },
  { value: 'can', labelTh: 'กระป๋อง', labelEn: 'Can' },
  { value: 'bottle', labelTh: 'ขวด', labelEn: 'Bottle' },
];

// Get default unit
export const getDefaultUnit = () => {
  return UNITS[0].value; // Default to kg
};
