const { getClient, azureConfig } = require('../config/azure');
const inventoryClient = require('../services/inventoryClient');

// Generate recipe based on provided ingredients
exports.generateRecipe = async (req, res) => {
  const { ingredients, craving, language = 'en' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = ingredients
    .map(item => {
      // Handle both string format and object format
      if (typeof item === 'string') {
        return item;
      }
      return `${item.name} (${item.quantity} ${item.unit})`;
    })
    .join(', ');

  try {

    const systemPrompt = language === 'th'
  ? `คุณเป็นเชฟมืออาชีพที่เชี่ยวชาญอาหารไทย คุณจะแนะนำเฉพาะเมนูที่สามารถทำได้จริงด้วยวัตถุดิบที่มีอยู่ โดยคำนึงถึง:
1. วัตถุดิบหลักและรองที่จำเป็นต้องมีครบ
2. สัดส่วนและปริมาณที่เหมาะสม
3. เทคนิคการทำที่เป็นไปได้จริง
4. รสชาติที่สมดุลและถูกต้องตามหลักอาหารไทย

ห้ามแนะนำเมนูที่ขาดวัตถุดิบสำคัญ หรือเมนูที่ผสมผสานวัตถุดิบแบบไม่เข้ากัน กรุณาตอบเป็นภาษาไทย`
  : `You are a professional Thai cuisine chef who suggests ONLY recipes that can actually be made with the available ingredients. Consider:
1. All essential primary and secondary ingredients must be available
2. Proper proportions and quantities
3. Realistic cooking techniques
4. Balanced flavors according to Thai cuisine principles

Never suggest dishes with missing critical ingredients or incompatible ingredient combinations. Respond in English.`;

    const userPrompt = craving
      ? (language === 'th'
        ? `ฉันอยากทาน${craving}\n\nวัตถุดิบที่มี: ${inventoryText}\n\nกรุณาดำเนินการตามลำดับ:
1. วิเคราะห์วัตถุดิบที่มี - ระบุว่ามีวัตถุดิบอะไรที่เข้ากันได้
2. เลือกเมนูที่ทำได้จริง - ต้องมีวัตถุดิบหลักครบทุกอย่าง (ถ้าขาดวัตถุดิบสำคัญ ห้ามแนะนำเมนูนั้น)
3. ตรวจสอบความเป็นไปได้ - ยืนยันว่าเมนูนี้สามารถทำได้ด้วยวัตถุดิบที่มีจริง
4. เขียนสูตรอาหารโดยระบุ:
   - ชื่อเมนู
   - วัตถุดิบที่ใช้จากตู้เย็น (ระบุชัดเจน)
   - วัตถุดิบที่ขาด (ถ้ามี - เป็นเครื่องปรุงพื้นฐานเท่านั้น เช่น น้ำปลา พริกไทย)
   - ขั้นตอนการทำแบบละเอียด
   - เหตุผลว่าทำไมเมนูนี้เหมาะสมกับวัตถุดิบที่มี

หากไม่มีวัตถุดิบเพียงพอที่จะทำเมนูตามที่อยากทาน ให้แนะนำเมนูอื่นที่ทำได้จริงแทน`
        : `I'm craving ${craving}\n\nAvailable ingredients: ${inventoryText}\n\nPlease follow these steps:
1. Analyze available ingredients - identify what ingredients work well together
2. Select a feasible dish - must have ALL essential ingredients (if missing critical ingredients, do NOT suggest that dish)
3. Verify feasibility - confirm this dish can actually be made with the available ingredients
4. Write the recipe including:
   - Dish name
   - Ingredients used from inventory (be specific)
   - Missing ingredients (if any - only basic seasonings like fish sauce, pepper)
   - Detailed cooking instructions
   - Rationale for why this dish works with available ingredients

If insufficient ingredients for the craving, suggest an alternative dish that CAN actually be made instead.`)
      : (language === 'th'
        ? `วัตถุดิบที่มี: ${inventoryText}\n\nช่วยแนะนำสูตรอาหารที่อร่อยที่ใช้วัตถุดิบเหล่านี้ให้หน่อย`
        : `Available ingredients: ${inventoryText}\n\nPlease suggest a delicious recipe using these ingredients.`);

    const client = getClient();
    const result = await client.getChatCompletions(
      azureConfig.deploymentName,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        maxTokens: 1000,
        temperature: 0.7,
      }
    );

    const recipe = result.choices[0]?.message?.content || 'No recipe generated';

    res.json({
      success: true,
      data: {
        recipe,
      },
    });
  } catch (error) {
    console.error('Generate recipe error:', error);

    // Fallback to mock recipe if Azure OpenAI fails
    const mockRecipe = language === 'th'
      ? `สูตร: ${craving || 'อาหารอร่อย'}\n\nวัตถุดิบ:\n${inventoryText}\n\nขั้นตอน:\n1. เตรียมวัตถุดิบทั้งหมด\n2. ผสมวัตถุดิบเข้าด้วยกัน\n3. ปรุงให้สุกใจ\n4. เสิร์ฟ\n\nสนุกกับอาหารของคุณ! 🍽️`
      : `Recipe: ${craving || 'Delicious Meal'}\n\nIngredients:\n${inventoryText}\n\nSteps:\n1. Prepare all ingredients\n2. Mix everything together\n3. Cook until done\n4. Serve\n\nEnjoy your meal! 🍽️`;

    res.json({
      success: true,
      data: {
        recipe: mockRecipe,
      },
    });
  }
};

// Suggest recipes based on expiring ingredients
exports.suggestByInventory = async (req, res) => {
  try {
    const { language = 'en' } = req.body;

    // Get items expiring within 3 days from Inventory Service
    const expiringItems = await inventoryClient.getExpiringItems(req.userId, 3);

    if (expiringItems.length === 0) {
      return res.json({
        success: true,
        message: language === 'th'
          ? 'ไม่มีวัตถุดิบที่ใกล้หมดอายุ'
          : 'No expiring ingredients found',
      });
    }

    const expiringText = expiringItems
      .map(item => `${item.name} (${item.quantity} ${item.unit})`)
      .join(', ');

    const systemPrompt = language === 'th'
      ? 'คุณเป็นผู้ช่วยทำอาหารที่ช่วยแนะนำสูตรอาหารเพื่อลดการทิ้งอาหาร'
      : 'You are a helpful cooking assistant focused on reducing food waste.';

    const userPrompt = language === 'th'
      ? `วัตถุดิบเหล่านี้กำลังจะหมดอายุ: ${expiringText}\n\nช่วยแนะนำสูตรอาหารที่ใช้วัตถุดิบเหล่านี้ก่อนที่จะหมดอายุ`
      : `These ingredients are expiring soon: ${expiringText}\n\nPlease suggest recipes to use them before they expire.`;

    const client = getClient();
    const result = await client.getChatCompletions(
      azureConfig.deploymentName,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        maxTokens: 800,
        temperature: 0.7,
      }
    );

    const suggestions = result.choices[0]?.message?.content || 'No suggestions generated';

    res.json({
      success: true,
      expiringItems,
      suggestions,
    });
  } catch (error) {
    console.error('Suggest recipes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suggest recipes',
      message: error.message,
    });
  }
};
