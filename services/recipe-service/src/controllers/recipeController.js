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
 * Body: { ingredients, language, craving }
 * craving: the user's raw message e.g. "เมนูง่ายๆตอนเช้า", "น้ำๆซดๆ", "มื้อกลางวัน"
 * Returns a numbered list of 3 dish names only, tailored to the craving.
 */
exports.suggestMenu = async (req, res) => {
  const { ingredients, language = 'en', craving = '' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = formatIngredients(ingredients);

  // Craving line — present in both system + user prompts so the model can't ignore it
  const cravingLineTH = craving
    ? `- ผู้ใช้อยากกิน: "${craving}" → แนะนำเมนูที่ตรงกับความต้องการนี้มากที่สุด เช่น ถ้าอยากกินอาหารเช้าก็แนะนำเมนูเช้า ถ้าอยากกินน้ำๆก็แนะนำเมนูน้ำ`
    : `- แนะนำเมนูที่เหมาะสมตามวัตถุดิบที่มี`;

  const cravingLineEN = craving
    ? `- User is craving: "${craving}" → tailor all 3 suggestions to match this context exactly`
    : `- Suggest suitable dishes based on available ingredients`;

  const systemPrompt = language === 'th'
    ? `คุณเป็นเชฟมืออาชีพ ทำหน้าที่แนะนำชื่อเมนูเท่านั้น ห้ามเขียนสูตรหรือขั้นตอนการทำอาหารในขั้นตอนนี้
กฎเด็ดขาด:
- แนะนำเฉพาะเมนูที่ทำได้จริงจากวัตถุดิบที่มี ห้ามแต่งเติมวัตถุดิบ
${cravingLineTH}
- ตอบเป็นรายการเลขเท่านั้น เช่น "1. ข้าวต้ม"
- ห้ามอธิบาย ห้ามเขียนวัตถุดิบ ห้ามบอกขั้นตอน
- แนะนำ 3 เมนูเท่านั้น`
    : `You are a professional chef. Your ONLY job is to suggest dish names — no recipes, no steps, no ingredient lists.
Rules:
- Suggest ONLY dishes achievable with the given ingredients. No substitutions.
${cravingLineEN}
- Reply as a numbered list only, e.g. "1. Congee"
- No explanations, no ingredient lists, no cooking steps
- Suggest exactly 3 dishes`;

  const cravingSection = craving
    ? (language === 'th' ? `\n\nสิ่งที่อยากกิน: "${craving}"` : `\n\nCraving: "${craving}"`)
    : '';

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}${cravingSection}\n\nแนะนำ 3 เมนูที่ตรงกับความต้องการ (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}${cravingSection}\n\nSuggest 3 matching dishes (dish names only)`;

  try {
    const menuText = await callAI(systemPrompt, userPrompt, 300);
    console.log('📋 Suggested Menu (Round 1):', menuText);
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
 * Body: { ingredients, previousMenus, craving, language }
 * previousMenus: string[] – dish names already shown, so we avoid repeating them.
 */
exports.resuggestMenu = async (req, res) => {
  const { ingredients, previousMenus = [], language = 'en', craving = '' } = req.body;
  console.log('🔄 Resuggest request - Craving:', craving || '(none)');

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = formatIngredients(ingredients);
  const noneText = language === 'th' ? 'ไม่มี' : 'none';
  const previousText = previousMenus.length ? previousMenus.join(', ') : noneText;

  // Keep craving context so the new batch still respects what the user originally wanted
  const cravingLineTH = craving
    ? `- ยังคงต้องตรงกับความต้องการ: "${craving}"`
    : '';
  const cravingLineEN = craving
    ? `- Still must match the craving: "${craving}"`
    : '';

  const systemPrompt = language === 'th'
    ? `คุณเป็นเชฟมืออาชีพ แนะนำเมนูใหม่ที่แตกต่างจากรอบก่อนหน้าโดยสิ้นเชิง ห้ามเขียนสูตรหรือขั้นตอน
กฎ:
- ห้ามซ้ำกับเมนูที่เคยแนะนำไปแล้วโดยเด็ดขาด แม้แต่เมนูที่คล้ายกัน
- แนะนำเฉพาะเมนูที่ทำได้จากวัตถุดิบที่มี
${cravingLineTH}
- ตอบเป็นรายการเลขเท่านั้น แนะนำ 3 เมนูเท่านั้น`
    : `You are a professional chef. Suggest COMPLETELY DIFFERENT dishes from the previous round. No recipes, no steps.
Rules:
- NEVER repeat or suggest anything similar to dishes already shown — completely fresh ideas only
- Only dishes achievable with given ingredients
${cravingLineEN}
- Reply as a numbered list only, suggest exactly 3 new dishes`;

  let cravingSectionResuggest = '';
  if (craving) {
    cravingSectionResuggest = language === 'th'
      ? `\n\nสิ่งที่อยากกิน: "${craving}"`
      : `\n\nCraving: "${craving}"`;
  }

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}${cravingSectionResuggest}\n\nเมนูที่แนะนำไปแล้ว (ห้ามซ้ำหรือคล้ายกัน): ${previousText}\n\nแนะนำ 3 เมนูใหม่ที่แตกต่างโดยสิ้นเชิง (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}${cravingSectionResuggest}\n\nAlready suggested (do NOT repeat or use similar dishes): ${previousText}\n\nSuggest 3 completely different dishes (dish names only)`;

  try {
    const menuText = await callAI(systemPrompt, userPrompt, 300);
    console.log('🔄 Re-suggested Menu (Round 2):', menuText);
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
🍽️ เมนู: [ชื่อ]

🛒 วัตถุดิบ (เฉพาะที่มี พร้อมปริมาณ)
- ใช้ขีด (-) สำหรับรายการวัตถุดิบ

👨‍🍳 ขั้นตอนการทำ (เรียงลำดับ บอกเวลาและอุณหภูมิ)
1. ขั้นตอนที่ 1
2. ขั้นตอนที่ 2

💡 เคล็ดลับ (1-2 ข้อ)

กฎสำคัญ:
- ห้ามใช้ markdown (ห้าม ###, **, ---, ####)
- ใช้เฉพาะวัตถุดิบที่มี ห้ามเพิ่มวัตถุดิบอื่น
- เขียนเป็นข้อความธรรมดา ไม่มีการจัดรูปแบบพิเศษ`
    : `You are a professional chef. The user has chosen a dish. Write a detailed recipe using ONLY the available ingredients.
Structure:
🍽️ Dish: [name]

🛒 Ingredients (available ones only, with measurements)
- Use dash (-) for ingredient list

👨‍🍳 Steps (numbered, include time & temperature)
1. Step 1
2. Step 2

💡 Tips (1-2 practical tips)

Important rules:
- NO markdown formatting (no ###, **, ---, ####)
- Use ONLY available ingredients, do not add others
- Write in plain text without special formatting`;

  const userPrompt = language === 'th'
    ? `เมนูที่เลือก: ${chosenDish}\nวัตถุดิบที่มี: ${inventoryText}\n\nเขียนสูตรอาหารแบบละเอียด`
    : `Chosen dish: ${chosenDish}\nAvailable ingredients: ${inventoryText}\n\nWrite a detailed recipe`;

  try {
    const recipe = await callAI(systemPrompt, userPrompt, 1000);
    console.log('👨‍🍳 Generated Recipe for:', chosenDish);
    console.log(recipe);
    res.json({ success: true, data: { recipe, dish: chosenDish } });
  } catch (error) {
    console.error('Generate recipe error:', error);

    const fallback = language === 'th'
      ? `🍽️ เมนู: ${chosenDish}\n\n🛒 วัตถุดิบ:\n${inventoryText}\n\n👨‍🍳 ขั้นตอน:\n1. เตรียมวัตถุดิบทั้งหมด\n2. ผสมและปรุงตามชอบ\n3. เสิร์ฟร้อนๆ 🍽️`
      : `🍽️ Dish: ${chosenDish}\n\n🛒 Ingredients:\n${inventoryText}\n\n👨‍🍳 Steps:\n1. Prepare all ingredients\n2. Cook as preferred\n3. Serve hot and enjoy! 🍽️`;

    console.log('⚠️ Using fallback recipe');
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

// ─────────────────────────────────────────────
// Intent check – is the user's message food-related?
// ─────────────────────────────────────────────
/**
 * Body: { message, language }
 * Returns: { intent: 'food' | 'other' }
 */
exports.checkIntent = async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return res.json({ success: true, intent: 'other' });
  }

  const systemPrompt = `You are an intent classifier for a cooking assistant app.
Reply with ONLY one word: "food" or "other". No punctuation, no explanation, nothing else.

"food" = the user wants to eat something, is hungry, asks about meals, dishes, cooking, ingredients, cravings, or anything related to food — in ANY language including Thai, English, or mixed.
"other" = greetings, unrelated questions, random text, or anything not about food.

Examples:
"อยากกินอะไรง่ายๆ" → food
"หิวข้าวมาก" → food
"น้ำๆซดๆ" → food
"มื้อกลางวันกินอะไรดี" → food
"I want soup" → food
"what can I cook for breakfast" → food
"hi" → other
"hello" → other
"สวัสดี" → other
"what time is it" → other`;

  const userPrompt = `Message: "${message}"`;

  try {
    const result = await callAI(systemPrompt, userPrompt, 5);
    console.log('Intent raw result:', JSON.stringify(result)); // Debug: See what Azure returns
    const intent = result.trim().toLowerCase().startsWith('food') ? 'food' : 'other';
    res.json({ success: true, intent });
  } catch (error) {
    console.error('Check intent error:', error);
    // Fail open — assume food so we don't block real requests
    res.json({ success: true, intent: 'food' });
  }
};