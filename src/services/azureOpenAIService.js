import { AZURE_OPENAI_CONFIG } from '../config/azureOpenAI';

/**
 * Call Azure OpenAI API to generate recipe suggestions
 * @param {string} craving - What the user is craving
 * @param {Array} inventory - Available inventory items
 * @param {string} language - Current language (th or en)
 * @returns {Promise<Object>} Recipe response
 */
export const generateRecipeSuggestion = async (craving, inventory, language = 'th') => {
  const { endpoint, apiKey, deploymentName, apiVersion } = AZURE_OPENAI_CONFIG;

  if (!endpoint || !apiKey || !deploymentName) {
    throw new Error('Azure OpenAI is not configured. Please check your .env file.');
  }

  // Format inventory items for the prompt
  const inventoryList = inventory
    .map((item) => `- ${item.name} (${item.quantity} ${language === 'th' ? 'ชิ้น' : 'pcs'})`)
    .join('\n');

  // const systemPrompt = language === 'th'
  //   ? `คุณเป็นผู้ช่วยทำอาหารที่เชี่ยวชาญในการแนะนำเมนูอาหาร คุณจะแนะนำเมนูอาหารที่เหมาะสมโดยอิงจากวัตถุดิบที่มีอยู่และสิ่งที่ผู้ใช้อยากทาน กรุณาตอบเป็นภาษาไทย`
  //   : `You are a cooking assistant that specializes in suggesting recipes based on available ingredients and user cravings. Please respond in English.`;
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

  const userPrompt = language === 'th'
    ? `ฉันอยากทาน: ${craving}\n\nวัตถุดิบที่มีในตู้เย็น:\n${inventoryList}\n\nกรุณาดำเนินการตามลำดับ:
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
    : `I'm craving: ${craving}\n\nAvailable ingredients in my fridge:\n${inventoryList}\n\nPlease follow these steps:
1. Analyze available ingredients - identify what ingredients work well together
2. Select a feasible dish - must have ALL essential ingredients (if missing critical ingredients, do NOT suggest that dish)
3. Verify feasibility - confirm this dish can actually be made with the available ingredients
4. Write the recipe including:
   - Dish name
   - Ingredients used from inventory (be specific)
   - Missing ingredients (if any - only basic seasonings like fish sauce, pepper)
   - Detailed cooking instructions
   - Rationale for why this dish works with available ingredients

If insufficient ingredients for the craving, suggest an alternative dish that CAN actually be made instead.`;

  try {
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const recipeText = data.choices[0]?.message?.content || '';

    // Parse the response to extract used ingredients
    const usedIngredients = extractUsedIngredients(recipeText, inventory);

    return {
      success: true,
      recipe: recipeText,
      usedIngredients,
    };
  } catch (error) {
    console.error('Azure OpenAI API Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Extract which ingredients from inventory were mentioned in the recipe
 * @param {string} recipeText - The generated recipe text
 * @param {Array} inventory - Available inventory items
 * @returns {Array} List of used ingredient IDs
 */
const extractUsedIngredients = (recipeText, inventory) => {
  const usedIngredients = [];
  const lowerRecipe = recipeText.toLowerCase();

  inventory.forEach((item) => {
    const itemName = item.name.toLowerCase();
    if (lowerRecipe.includes(itemName)) {
      usedIngredients.push(item.id);
    }
  });

  return usedIngredients;
};

/**
 * Send a chat message to Azure OpenAI
 * @param {Array} messages - Chat history
 * @param {string} language - Current language
 * @returns {Promise<Object>} Chat response
 */
export const sendChatMessage = async (messages, language = 'th') => {
  const { endpoint, apiKey, deploymentName, apiVersion } = AZURE_OPENAI_CONFIG;

  if (!endpoint || !apiKey || !deploymentName) {
    throw new Error('Azure OpenAI is not configured. Please check your .env file.');
  }

  const systemPrompt = language === 'th'
    ? `คุณเป็นผู้ช่วยทำอาหารที่เป็นมิตรและช่วยเหลือเกี่ยวกับเรื่องอาหารและการทำอาหาร กรุณาตอบเป็นภาษาไทย`
    : `You are a friendly cooking assistant that helps with food and cooking related questions. Please respond in English.`;

  try {
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const messageContent = data.choices[0]?.message?.content || '';

    return {
      success: true,
      message: messageContent,
    };
  } catch (error) {
    console.error('Azure OpenAI Chat Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
