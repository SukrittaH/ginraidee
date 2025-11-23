const { getClient, azureConfig } = require('../config/azure');
const { InventoryItem } = require('../models');
const { Op } = require('sequelize');

// Generate recipe based on provided ingredients
exports.generateRecipe = async (req, res) => {
  const { ingredients, craving, language = 'en' } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const inventoryText = ingredients
    .map(item => `${item.name} (${item.quantity} ${item.unit})`)
    .join(', ');

  try {

    const systemPrompt = language === 'th'
      ? 'คุณเป็นผู้ช่วยทำอาหารที่เชี่ยวชาญในการแนะนำเมนูอาหาร'
      : 'You are a helpful cooking assistant that suggests recipes based on available ingredients.';

    const userPrompt = craving
      ? (language === 'th'
        ? `ฉันอยากทาน${craving}\n\nวัตถุดิบที่มี: ${inventoryText}\n\nช่วยแนะนำสูตรอาหารที่ใช้วัตถุดิบเหล่านี้ให้หน่อย`
        : `I'm craving ${craving}\n\nAvailable ingredients: ${inventoryText}\n\nPlease suggest a recipe using these ingredients.`)
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

    // Get items expiring within 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiringItems = await InventoryItem.findAll({
      where: {
        userId: req.userId,
        expirationDate: {
          [Op.lte]: threeDaysFromNow,
        },
      },
      order: [['expirationDate', 'ASC']],
    });

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
