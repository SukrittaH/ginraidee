const { getClient, azureConfig } = require('../config/azure');
const inventoryClient = require('../services/inventoryClient');
const { trace } = require('@opentelemetry/api');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  // Limit length to prevent abuse
  return input.substring(0, 500);
};

const formatIngredients = (ingredients) =>
  ingredients
    .map(item =>
      typeof item === 'string' ? item : `${item.name} (${item.quantity} ${item.unit})`
    )
    .join(', ');

const callAI = async (systemPrompt, userPrompt, maxTokens = 600) => {
  const tracer = trace.getTracer('recipe-controller');
  const span = tracer.startSpan('azure_openai_call', {
    attributes: {
      'ai.model': azureConfig.deploymentName,
      'ai.max_tokens': maxTokens,
      'ai.temperature': 0.7,
    },
  });

  const startTime = Date.now();

  try {
    logger.debug('Calling Azure OpenAI API', {
      model: azureConfig.deploymentName,
      max_tokens: maxTokens,
      system_prompt_length: systemPrompt.length,
      user_prompt_length: userPrompt.length,
    });

    const client = getClient();
    const result = await client.getChatCompletions(
      azureConfig.deploymentName,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt  },
      ],
      { maxTokens, temperature: 0.7 }
    );

    const content = result.choices[0]?.message?.content || '';
    const duration = Date.now() - startTime;

    span.setAttribute('ai.response_length', content.length);
    span.setStatus({ code: 1 }); // OK

    logger.logExternalCall('azure-openai', 'getChatCompletions', duration, true);
    logger.info('Azure OpenAI API call successful', {
      model: azureConfig.deploymentName,
      response_length: content.length,
      duration_ms: duration,
    });

    return content;
  } catch (error) {
    const duration = Date.now() - startTime;
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // ERROR

    logger.logExternalCall('azure-openai', 'getChatCompletions', duration, false, error);
    logger.error('Azure OpenAI API call failed', {
      model: azureConfig.deploymentName,
      error: error.message,
      duration_ms: duration,
    });

    throw error;
  } finally {
    span.end();
  }
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
  const tracer = trace.getTracer('recipe-controller');
  const span = tracer.startSpan('suggestMenu', {
    attributes: {
      'recipe.language': req.body.language || 'en',
      'recipe.has_craving': !!req.body.craving,
      'recipe.ingredients_count': req.body.ingredients?.length || 0,
    },
  });

  try {
    const { ingredients, language = 'en', craving = '' } = req.body;

    logger.info('Suggest menu request received', {
      language,
      ingredients_count: ingredients?.length || 0,
      has_craving: !!craving,
    });

    if (!ingredients || ingredients.length === 0) {
      span.setStatus({ code: 2, message: 'Ingredients required' });
      logger.warn('Suggest menu failed: No ingredients provided');
      return res.status(400).json({ error: 'Ingredients are required' });
    }

    const inventoryText = formatIngredients(ingredients);
    const sanitizedCraving = sanitizeInput(craving);

  // Craving line — present in both system + user prompts so the model can't ignore it
  const cravingLineTH = sanitizedCraving
    ? `- ผู้ใช้อยากกิน: "${sanitizedCraving}" → แนะนำเมนูที่ตรงกับความต้องการนี้มากที่สุด เช่น ถ้าอยากกินอาหารเช้าก็แนะนำเมนูเช้า ถ้าอยากกินน้ำๆก็แนะนำเมนูน้ำ`
    : `- แนะนำเมนูที่เหมาะสมตามวัตถุดิบที่มี`;

  const cravingLineEN = sanitizedCraving
    ? `- User is craving: "${sanitizedCraving}" → tailor all 3 suggestions to match this context exactly`
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

  let cravingSection = '';
  if (sanitizedCraving) {
    cravingSection = language === 'th'
      ? `\n\nสิ่งที่อยากกิน: "${sanitizedCraving}"`
      : `\n\nCraving: "${sanitizedCraving}"`;
  }

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}${cravingSection}\n\nแนะนำ 3 เมนูที่ตรงกับความต้องการ (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}${cravingSection}\n\nSuggest 3 matching dishes (dish names only)`;

    const menuText = await callAI(systemPrompt, userPrompt, 300);

    span.setStatus({ code: 1 }); // OK

    logger.logBusinessEvent('menu_suggested', {
      language,
      ingredients_count: ingredients.length,
      has_craving: !!sanitizedCraving,
      round: 1,
      menu_length: menuText.length,
    });

    logger.info('Menu suggestions generated successfully', {
      round: 1,
      menu_preview: menuText.substring(0, 100),
    });

    res.json({ success: true, data: { menu: menuText, round: 1 } });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });

    logger.error('Suggest menu failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ success: false, error: 'Failed to suggest menu', message: error.message });
  } finally {
    span.end();
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

  logger.info('Resuggest menu request received', {
    language,
    ingredients_count: ingredients?.length || 0,
    previous_menus_count: previousMenus?.length || 0,
    has_craving: !!craving,
  });

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = formatIngredients(ingredients);
  const noneText = language === 'th' ? 'ไม่มี' : 'none';
  const sanitizedPreviousMenus = previousMenus.map(menu => sanitizeInput(menu));
  const previousText = sanitizedPreviousMenus.length ? sanitizedPreviousMenus.join(', ') : noneText;
  const sanitizedCraving = sanitizeInput(craving);

  // Keep craving context so the new batch still respects what the user originally wanted
  const cravingLineTH = sanitizedCraving
    ? `- ยังคงต้องตรงกับความต้องการ: "${sanitizedCraving}"`
    : '';
  const cravingLineEN = sanitizedCraving
    ? `- Still must match the craving: "${sanitizedCraving}"`
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
  if (sanitizedCraving) {
    cravingSectionResuggest = language === 'th'
      ? `\n\nสิ่งที่อยากกิน: "${sanitizedCraving}"`
      : `\n\nCraving: "${sanitizedCraving}"`;
  }

  const userPrompt = language === 'th'
    ? `วัตถุดิบที่มี: ${inventoryText}${cravingSectionResuggest}\n\nเมนูที่แนะนำไปแล้ว (ห้ามซ้ำหรือคล้ายกัน): ${previousText}\n\nแนะนำ 3 เมนูใหม่ที่แตกต่างโดยสิ้นเชิง (ชื่อเมนูเท่านั้น)`
    : `Available ingredients: ${inventoryText}${cravingSectionResuggest}\n\nAlready suggested (do NOT repeat or use similar dishes): ${previousText}\n\nSuggest 3 completely different dishes (dish names only)`;

  try {
    const menuText = await callAI(systemPrompt, userPrompt, 300);

    logger.logBusinessEvent('menu_resuggest', {
      language,
      ingredients_count: ingredients.length,
      has_craving: !!sanitizedCraving,
      round: 2,
      menu_length: menuText.length,
    });

    res.json({ success: true, data: { menu: menuText, round: 2 } });
  } catch (error) {
    logger.error('Resuggest menu failed', {
      error: error.message,
      stack: error.stack,
    });
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
  const tracer = trace.getTracer('recipe-controller');
  const span = tracer.startSpan('generateRecipe', {
    attributes: {
      'recipe.language': req.body.language || 'en',
      'recipe.dish': req.body.dish || req.body.craving || 'unknown',
      'recipe.ingredients_count': req.body.ingredients?.length || 0,
    },
  });

  // Declare variables outside try block so they're available in catch for fallback
  let chosenDish;
  let inventoryText;
  let language;

  try {
    const { ingredients, craving, dish = '' } = req.body;
    language = req.body.language || 'en';

    if (!ingredients || ingredients.length === 0) {
      span.setStatus({ code: 2, message: 'Ingredients required' });
      return res.status(400).json({ error: 'Ingredients are required' });
    }
    if (!dish && !craving) {
      span.setStatus({ code: 2, message: 'Dish or craving required' });
      return res.status(400).json({ error: 'Dish or craving required' });
    }

    chosenDish    = dish || craving;
    inventoryText = formatIngredients(ingredients);

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

    const recipe = await callAI(systemPrompt, userPrompt, 1000);

    span.setAttribute('recipe.output_length', recipe.length);
    span.setStatus({ code: 1 }); // OK

    logger.logBusinessEvent('recipe_generated', {
      language,
      dish: chosenDish,
      recipe_length: recipe.length,
    });

    res.json({ success: true, data: { recipe, dish: chosenDish } });
  } catch (error) {
    span.recordException(error);

    logger.error('Generate recipe failed', {
      dish: chosenDish,
      error: error.message,
      stack: error.stack,
    });

    const fallback = language === 'th'
      ? `🍽️ เมนู: ${chosenDish}\n\n🛒 วัตถุดิบ:\n${inventoryText}\n\n👨‍🍳 ขั้นตอน:\n1. เตรียมวัตถุดิบทั้งหมด\n2. ผสมและปรุงตามชอบ\n3. เสิร์ฟร้อนๆ 🍽️`
      : `🍽️ Dish: ${chosenDish}\n\n🛒 Ingredients:\n${inventoryText}\n\n👨‍🍳 Steps:\n1. Prepare all ingredients\n2. Cook as preferred\n3. Serve hot and enjoy! 🍽️`;

    logger.warn('Using fallback recipe due to error', {
      dish: chosenDish,
    });

    span.setAttribute('recipe.used_fallback', true);
    span.setStatus({ code: 2, message: 'Used fallback recipe' });
    res.json({ success: true, data: { recipe: fallback, dish: chosenDish } });
  } finally {
    span.end();
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

    logger.logBusinessEvent('expiring_items_suggestions', {
      language,
      expiring_items_count: expiringItems.length,
    });

    res.json({ success: true, expiringItems, suggestions });
  } catch (error) {
    logger.error('Suggest by inventory failed', {
      error: error.message,
      stack: error.stack,
    });
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
    const intent = result.trim().toLowerCase().startsWith('food') ? 'food' : 'other';

    logger.debug('Intent check result', {
      message: message.substring(0, 50),
      intent,
      raw_result: result,
    });

    res.json({ success: true, intent });
  } catch (error) {
    logger.error('Check intent failed', {
      message: message.substring(0, 50),
      error: error.message,
    });
    // Fail open — assume food so we don't block real requests
    res.json({ success: true, intent: 'food' });
  }
};