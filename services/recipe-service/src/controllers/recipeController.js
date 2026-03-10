const { getClient, azureConfig } = require('../config/azure');
const inventoryClient = require('../services/inventoryClient');

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const formatIngredients = (ingredients) =>
  ingredients
    .map(item =>
      typeof item === 'string' ? item : `${item.name} (${item.quantity} ${item.unit})`
    )
    .join(', ');

const callAI = async (systemPrompt, userPrompt, maxTokens = 600) => {
  const client = getClient();
  const result = await client.getChatCompletions(
    azureConfig.deploymentName,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt  },
    ],
    { maxTokens, temperature: 0.7 }
  );
  return result.choices[0]?.message?.content || '';
};

// ─────────────────────────────────────────────
// Step 1 – Suggest a short menu list (NO recipes)
// ─────────────────────────────────────────────
/**
 * Body: { ingredients, language }
 * Returns a numbered list of 5 dish names only.
 */
exports.suggestMenu = async (req, res) => {
  const { ingredients, language = 'en' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = formatIngredients(ingredients);

  const systemPrompt = language === 'th'
    ? `คุณเป็นเชฟมืออาชีพ ทำหน้าที่แนะนำชื่อเมนูเท่านั้น ห้ามเขียนสูตรหรือขั้นตอนการทำอาหารในขั้นตอนนี้
กฎเด็ดขาด:
- แนะนำเฉพาะเมนูที่ทำได้จริงจากวัตถุดิบที่มี ห้ามแต่งเติมวัตถุดิบ
- ตอบเป็นรายการเลขเท่านั้น เช่น "1. ผัดกระเพรา"
- ห้ามอธิบาย ห้ามเขียนวัตถุดิบ ห้ามบอกขั้นตอน
- แนะนำ 3 เมนูเท่านั้น`
    : `You are a professional chef. Your ONLY job right now is to suggest dish names — no recipes, no steps, no ingredients list.
Rules:
- Suggest ONLY dishes achievable with the given ingredients. No substitutions.
- Reply as a numbered list only, e.g. "1. Pad Kra Pao"
- No explanations, no ingredient lists, no cooking steps
- Suggest exactly 3 dishes`;

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}\n\nแนะนำ 3 เมนูที่ทำได้ (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}\n\nSuggest 3 dishes I can make (dish names only)`;

  try {
    const menuText = await callAI(systemPrompt, userPrompt, 300);
    res.json({ success: true, data: { menu: menuText, round: 1 } });
  } catch (error) {
    console.error('Suggest menu error:', error);
    res.status(500).json({ success: false, error: 'Failed to suggest menu', message: error.message });
  }
};

// ─────────────────────────────────────────────
// Step 1b – Re-suggest different menus (user didn't like first batch)
// ─────────────────────────────────────────────
/**
 * Body: { ingredients, previousMenus, language }
 * previousMenus: string[] – dish names already shown, so we avoid repeating them.
 */
exports.resuggestMenu = async (req, res) => {
  const { ingredients, previousMenus = [], language = 'en' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText  = formatIngredients(ingredients);
  const previousText   = previousMenus.length
    ? previousMenus.join(', ')
    : language === 'th' ? 'ไม่มี' : 'none';

  const systemPrompt = language === 'th'
    ? `คุณเป็นเชฟมืออาชีพ แนะนำเมนูใหม่ที่แตกต่างจากรอบก่อนหน้าโดยสิ้นเชิง ห้ามเขียนสูตรหรือขั้นตอน
กฎ:
- ห้ามซ้ำกับเมนูที่เคยแนะนำไปแล้วโดยเด็ดขาด แม้แต่เมนูที่คล้ายกัน
- แนะนำเฉพาะเมนูที่ทำได้จากวัตถุดิบที่มี
- ตอบเป็นรายการเลขเท่านั้น แนะนำ 3 เมนูเท่านั้น`
    : `You are a professional chef. Suggest COMPLETELY DIFFERENT dishes from the previous round. No recipes, no steps.
Rules:
- NEVER repeat or suggest anything similar to dishes already shown — completely fresh ideas only
- Only dishes achievable with given ingredients
- Reply as a numbered list only, suggest exactly 3 new dishes`;

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}\n\nเมนูที่แนะนำไปแล้ว (ห้ามซ้ำหรือคล้ายกัน): ${previousText}\n\nแนะนำ 3 เมนูใหม่ที่แตกต่างโดยสิ้นเชิง (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}\n\nAlready suggested (do NOT repeat or use similar dishes): ${previousText}\n\nSuggest 3 completely different dishes (dish names only)`;

  try {
    const menuText = await callAI(systemPrompt, userPrompt, 300);
    res.json({ success: true, data: { menu: menuText, round: 2 } });
  } catch (error) {
    console.error('Re-suggest menu error:', error);
    res.status(500).json({ success: false, error: 'Failed to re-suggest menu', message: error.message });
  }
};

// ─────────────────────────────────────────────
// Step 2 – Generate full recipe after user picks a dish
// ─────────────────────────────────────────────
/**
 * Body: { ingredients, dish, language }
 */
exports.generateRecipe = async (req, res) => {
  const { ingredients, craving, language = 'en', dish = '' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }
  if (!dish && !craving) {
    return res.status(400).json({ error: 'Dish or craving required' });
  }

  const chosenDish    = dish || craving;
  const inventoryText = formatIngredients(ingredients);

  const systemPrompt = language === 'th'
    ? `คุณเป็นเชฟมืออาชีพ ผู้ใช้เลือกเมนูแล้ว ให้เขียนสูตรอาหารแบบละเอียดตามโครงสร้างนี้:
1. 🍽️ เมนู: [ชื่อ]
2. 🛒 วัตถุดิบ (เฉพาะที่มี พร้อมปริมาณ)
3. 👨‍🍳 ขั้นตอนการทำ (เรียงลำดับ บอกเวลาและอุณหภูมิ)
4. 💡 เคล็ดลับ (1-2 ข้อ)
ใช้เฉพาะวัตถุดิบที่มี ห้ามเพิ่มวัตถุดิบอื่น`
    : `You are a professional chef. The user has chosen a dish. Write a detailed recipe using ONLY the available ingredients.
Structure:
1. 🍽️ Dish: [name]
2. 🛒 Ingredients (available ones only, with measurements)
3. 👨‍🍳 Steps (numbered, include time & temperature)
4. 💡 Tips (1-2 practical tips)
Do NOT add ingredients that are not in the available list.`;

  const userPrompt = language === 'th'
    ? `เมนูที่เลือก: ${chosenDish}\nวัตถุดิบที่มี: ${inventoryText}\n\nเขียนสูตรอาหารแบบละเอียด`
    : `Chosen dish: ${chosenDish}\nAvailable ingredients: ${inventoryText}\n\nWrite a detailed recipe`;

  try {
    const recipe = await callAI(systemPrompt, userPrompt, 1000);
    res.json({ success: true, data: { recipe, dish: chosenDish } });
  } catch (error) {
    console.error('Generate recipe error:', error);

    // Graceful fallback so the UI never breaks
    const fallback = language === 'th'
      ? `🍽️ เมนู: ${chosenDish}\n\n🛒 วัตถุดิบ:\n${inventoryText}\n\n👨‍🍳 ขั้นตอน:\n1. เตรียมวัตถุดิบทั้งหมด\n2. ผสมและปรุงตามชอบ\n3. เสิร์ฟร้อนๆ 🍽️`
      : `🍽️ Dish: ${chosenDish}\n\n🛒 Ingredients:\n${inventoryText}\n\n👨‍🍳 Steps:\n1. Prepare all ingredients\n2. Cook as preferred\n3. Serve hot and enjoy! 🍽️`;

    res.json({ success: true, data: { recipe: fallback, dish: chosenDish } });
  }
};

// ─────────────────────────────────────────────
// Bonus – Suggest by expiring inventory
// ─────────────────────────────────────────────
exports.suggestByInventory = async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    const expiringItems = await inventoryClient.getExpiringItems(req.userId, 3);

    if (expiringItems.length === 0) {
      return res.json({
        success: true,
        message: language === 'th' ? 'ไม่มีวัตถุดิบที่ใกล้หมดอายุ' : 'No expiring ingredients found',
      });
    }

    const expiringText = expiringItems
      .map(item => `${item.name} (${item.quantity} ${item.unit})`)
      .join(', ');

    const systemPrompt = language === 'th'
      ? `คุณเป็นเชฟที่ช่วยลดการทิ้งอาหาร แนะนำเฉพาะชื่อเมนูที่ใช้วัตถุดิบใกล้หมดอายุ ตอบเป็นรายการเลข 3 เมนู ห้ามเขียนสูตร`
      : `You are a zero-waste chef. Suggest dish names that use expiring ingredients. Reply as a numbered list of 3 dishes only. No recipes.`;

    const userPrompt = language === 'th'
      ? `วัตถุดิบใกล้หมดอายุ: ${expiringText}\n\nแนะนำ 3 เมนูเพื่อใช้วัตถุดิบเหล่านี้ (ชื่อเมนูเท่านั้น)`
      : `Expiring ingredients: ${expiringText}\n\nSuggest 3 dishes to use them up (dish names only)`;

    const suggestions = await callAI(systemPrompt, userPrompt, 400);
    res.json({ success: true, expiringItems, suggestions });
  } catch (error) {
    console.error('Suggest by inventory error:', error);
    res.status(500).json({ success: false, error: 'Failed to suggest recipes', message: error.message });
  }
};