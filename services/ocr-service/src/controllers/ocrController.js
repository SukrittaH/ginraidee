const axios = require('axios');

// Azure Document Intelligence API configuration
const AZURE_DI_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'https://your-resource.cognitiveservices.azure.com/';
const AZURE_DI_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

// Validate configuration
const isConfigured = () => {
  return !!(AZURE_DI_ENDPOINT && AZURE_DI_KEY);
};

/**
 * Parse structured retail label format (Thai + English product labels)
 * Expected format:
 * Line 1: Thai product name
 * Line 2: English product name
 * Line 3: Weight (with unit)
 * Line N: MFG: DD.MM.YYYY
 * Line N+1: BBF: DD.MM.YYYY (Best Before)
 */
const parseStructuredLabel = (lines, ocrText) => {
  console.log('🏷️ Attempting structured label parsing...');

  let productNameThai = null;
  let productNameEnglish = null;
  let quantity = 1;
  let unit = 'piece';
  let manufacturingDate = null;
  let expiryDate = null;

  // Find MFG and BBF lines first for reference
  let mfgIndex = -1;
  let bbfIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    if (/^mfg[:\s]/i.test(line) || /วันที่ผลิต/i.test(line)) {
      mfgIndex = i;
    }
    // Also match Thai "ควรบริโภคก่อน" (best before)
    if (/^bbf[:\s]/i.test(line) || /^exp[:\s]/i.test(line) || /best\s*before|ควรบริโภคก่อน|วันหมดอายุ/i.test(lineLower)) {
      bbfIndex = i;
    }
  }

  console.log(`🔍 Found MFG at line ${mfgIndex}, BBF at line ${bbfIndex}`);

  // Extract product names (should be first non-metadata line)
  // Product name might be bilingual on one line: "Thai Name English Name"
  const productLines = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];

    // Skip lines that are clearly metadata
    if (/^mfg[:\s]/i.test(line) || /^bbf[:\s]/i.test(line) || /^exp[:\s]/i.test(line)) continue;
    if (/^\d+[\d\.\/-]*$/.test(line)) continue; // Skip pure numbers
    if (/น้ำหนักสุทธิ|ปริมาณสุทธิ|วันที่ผลิต|ควรบริโภคก่อน|ราคา/i.test(line)) continue; // Skip metadata
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(line)) continue; // Skip dates

    // Check if line looks like a product name
    const hasThaiChars = /[ก-๙]/.test(line);
    const hasEnglishChars = /[a-zA-Z]/.test(line);
    const hasMinLength = line.length >= 3;

    // Skip if line is mostly numbers
    const numberRatio = (line.match(/\d/g) || []).length / line.length;
    if (numberRatio > 0.5) continue;

    if (hasMinLength && (hasThaiChars || hasEnglishChars)) {
      productLines.push({ line, hasThaiChars, hasEnglishChars, index: i });
    }
  }

  // Handle bilingual names on one line (Thai + English together)
  if (productLines.length >= 1) {
    const firstLine = productLines[0].line;
    const hasThaiChars = /[ก-๙]/.test(firstLine);
    const hasEnglishChars = /[a-zA-Z]/.test(firstLine);

    if (hasThaiChars && hasEnglishChars) {
      // Bilingual line: split Thai and English
      // Pattern: Thai characters followed by English words
      const parts = firstLine.match(/([ก-๙\s\.]+)\s+([A-Za-z\s]+)/);
      if (parts && parts.length >= 3) {
        productNameThai = parts[1].trim();
        let cleanEnglish = parts[2].trim();
        cleanEnglish = cleanEnglish.replace(/\s*(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
        productNameEnglish = cleanEnglish;
        console.log(`🔍 Bilingual product name: Thai="${productNameThai}", Eng="${productNameEnglish}"`);
      }
    } else {
      // Single language lines
      for (const { line, hasThaiChars, hasEnglishChars } of productLines) {
        if (!productNameThai && hasThaiChars) {
          productNameThai = line.trim();
          console.log(`🔍 Thai product name: ${productNameThai}`);
        }
        if (!productNameEnglish && hasEnglishChars) {
          let cleanName = line.trim();
          cleanName = cleanName.replace(/\s*(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
          cleanName = cleanName.replace(/(KG|G|ML|L)$/i, '').trim();
          productNameEnglish = cleanName;
          console.log(`🔍 English product name: ${productNameEnglish}`);
        }
      }
    }
  }

  // Extract weight - look for "น้ำหนักสุทธิ" (Net Weight) line first
  // Pattern: "น้ำหนักสุทธิ 0.272 ก.ก. ราคารวม 42.25 บาท"
  // BUT: OCR often garbles Thai text, e.g., "น้ำหนักสุทธิ" → "KIWIÁnBY6", "กก." → "nn."
  const netWeightPattern = /น้ำหนักสุทธิ\s*(\d+(?:\.\d+)?)\s*(ก\.ก\.|กก\.?|g|kg|กรัม|กิโลกรัม|ml|l)/i;

  for (const line of lines) {
    const netMatch = line.match(netWeightPattern);
    if (netMatch) {
      quantity = parseFloat(netMatch[1]);
      const unitText = netMatch[2].toLowerCase();

      // Map unit to standard format
      if (/ก\.ก\.|กก\.?|kg|กิโลกรัม/.test(unitText)) unit = 'kg';
      else if (/^g$|กรัม/.test(unitText)) unit = 'g';
      else if (/ml|มิลลิลิตร/.test(unitText)) unit = 'ml';
      else if (/^l$|ลิตร/.test(unitText)) unit = 'L';

      console.log(`✅ Net weight found: ${quantity} ${unit} (from: "${line}")`);
      break;
    }
  }

  // Fallback: OCR often garbles Thai text - look for patterns like "0.422 nn." or similar
  // Common garbled patterns: "nn." "11." "1n." for "กก." (kg)
  if (quantity === 1 && unit === 'piece') {
    console.log('⚠️ น้ำหนักสุทธิ not found clearly, checking for garbled patterns...');

    for (const line of lines) {
      // Look for weight-like numbers (0.001-50.0) followed by garbled unit patterns
      // Pattern: any 2 chars followed by period (common OCR mistake for "กก.")
      const garbledMatch = line.match(/(\d+\.\d{1,3})\s*([a-z]{1,2}\.)/i);
      if (garbledMatch) {
        const potentialQty = parseFloat(garbledMatch[1]);
        const garbledUnit = garbledMatch[2].toLowerCase();

        // Check if this looks like a weight (reasonable range)
        if (potentialQty > 0 && potentialQty <= 50) {
          // Common garbled patterns for "กก." (kg): "nn.", "11.", "1n.", "ln."
          if (/^(nn\.|11\.|1n\.|ln\.|rn\.)/.test(garbledUnit)) {
            quantity = potentialQty;
            unit = 'kg';
            console.log(`✅ Weight found from garbled OCR: ${quantity} ${unit} (from: "${line}", garbled unit: "${garbledUnit}")`);
            break;
          }
        }
      }
    }
  }

  // Fallback: try general weight patterns if น้ำหนักสุทธิ not found
  if (quantity === 1 && unit === 'piece') {
    console.log('⚠️ น้ำหนักสุทธิ not found, trying general patterns...');

    const weightPatterns = [
      // Thai format: "0.272 ก.ก." (with periods)
      /(\d+(?:\.\d+)?)\s*(ก\.ก\.)/i,
      // Thai abbreviated: "0.272 กก." or "กก"
      /(\d+(?:\.\d+)?)\s*(กก\.?)/i,
      // Standard format: "500 g" or "0.5 kg"
      /(\d+(?:\.\d+)?)\s*(g|kg|ml|l|กรัม|กิโลกรัม)\b/i,
      // Thai format: "500 กรัม"
      /(\d+(?:\.\d+)?)\s*(กรัม|กิโลกรัม|มิลลิลิตร|ลิตร)/i,
      // Compact format: "500g" (no space)
      /(\d+(?:\.\d+)?)(g|kg|ml|l)\b/i,
      // At end of line: "PORK 500G"
      /(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/i,
    ];

    for (const line of lines) {
      console.log(`🔍 Checking line for weight: "${line}"`);

      // Try each weight pattern FIRST (before skipping)
      let foundWeight = false;
      for (const pattern of weightPatterns) {
        const match = line.match(pattern);
        if (match) {
          const potentialQty = parseFloat(match[1]);
          const unitText = match[2].toLowerCase();

          // Map unit to standard format
          let detectedUnit = 'piece';
          if (/ก\.ก\.|กก\.?|kg|กิโลกรัม/.test(unitText)) detectedUnit = 'kg';
          else if (/^g$|กรัม/.test(unitText)) detectedUnit = 'g';
          else if (/ml|มิลลิลิตร/.test(unitText)) detectedUnit = 'ml';
          else if (/^l$|ลิตร/.test(unitText)) detectedUnit = 'L';

          // Sanity check: weight should be reasonable (0.01 to 50 kg for most products)
          const isReasonable = (
            (detectedUnit === 'kg' && potentialQty > 0 && potentialQty <= 50) ||
            (detectedUnit === 'g' && potentialQty > 0 && potentialQty <= 50000) ||
            (detectedUnit === 'ml' && potentialQty > 0 && potentialQty <= 50000) ||
            (detectedUnit === 'L' && potentialQty > 0 && potentialQty <= 50)
          );

          if (isReasonable) {
            quantity = potentialQty;
            unit = detectedUnit;
            foundWeight = true;
            console.log(`✅ Weight found (fallback): ${quantity} ${unit} (from: "${line}")`);
            break;
          } else {
            console.log(`  ⚠️ Weight ${potentialQty} ${detectedUnit} seems unreasonable, skipping`);
          }
        }
      }

      // If we found a weight, stop searching
      if (foundWeight) break;
    }

    if (quantity === 1 && unit === 'piece') {
      console.log(`⚠️ No weight detected, using default: 1 piece`);
    }
  }

  // Extract MFG date
  if (mfgIndex >= 0) {
    const mfgLine = lines[mfgIndex];
    const dateMatch = mfgLine.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);
      if (year < 100) year += 2000;

      if (day <= 31 && month <= 12) {
        manufacturingDate = new Date(year, month - 1, day);
        console.log(`🔍 MFG: ${manufacturingDate.toLocaleDateString()}`);
      }
    }
  }

  // Extract BBF/EXP date
  if (bbfIndex >= 0) {
    const bbfLine = lines[bbfIndex];
    const dateMatch = bbfLine.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);
      if (year < 100) year += 2000;

      if (day <= 31 && month <= 12) {
        expiryDate = new Date(year, month - 1, day);
        console.log(`🔍 BBF/EXP: ${expiryDate.toLocaleDateString()}`);
      }
    }
  }

  // Prefer English name, fallback to Thai
  const productName = productNameEnglish || productNameThai || 'Product';

  return {
    name: productName,
    quantity,
    unit,
    expiryDate,
    manufacturingDate,
    structured: true, // Flag to indicate this used structured parsing
  };
};

/**
 * Parse OCR result to extract product information
 * Tries structured parsing first, falls back to general parsing
 */
const parseOCRText = (ocrText, language = 'th') => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const textLower = ocrText.toLowerCase();

  console.log('📄 OCR Text Lines:', lines);

  // Try structured label parsing first (for Thai retail labels)
  const hasMFG = /\bmfg[:\s]/i.test(ocrText) || /วันที่ผลิต/i.test(ocrText);
  const hasBBF = /\bbbf[:\s]/i.test(ocrText) || /best\s*before/i.test(ocrText);

  if (hasMFG || hasBBF) {
    console.log('🏷️ Detected structured label format (MFG/BBF present)');
    const structured = parseStructuredLabel(lines, ocrText);
    if (structured.name !== 'Product') {
      console.log('✅ Structured parsing successful');
      return structured;
    }
    console.log('⚠️ Structured parsing incomplete, falling back to general parsing');
  }

  // Extract product name - find the cleanest readable line
  let productName = 'Product';

  // Helper function to check if a string is mostly readable (English, Thai, or common characters)
  const isReadable = (text) => {
    // Count readable characters (letters, numbers, spaces, common punctuation)
    const readable = text.match(/[a-zA-Z0-9\s\-.,ก-๙]/g) || [];
    const total = text.length;

    // Check for excessive special/Cyrillic characters (common in garbled OCR)
    const garbledChars = text.match(/[А-Яа-яЁёЪъмьЭэ@#$%^&*(){}[\]|\\<>]/g) || [];
    const hasGarbledChars = garbledChars.length > text.length * 0.2; // More than 20% garbled

    // At least 80% should be readable characters (stricter than before)
    const readableRatio = readable.length / total;
    return readableRatio >= 0.8 && !hasGarbledChars;
  };

  // Helper function to check if text looks like a product name
  const looksLikeProductName = (text) => {
    // Should have some letters (not just numbers/symbols)
    const hasLetters = /[a-zA-Zก-๙]/.test(text);
    // Should not start with price-like patterns
    const notPrice = !/^\d+\.\d{2}$/.test(text);
    // Should not be just a barcode
    const notBarcode = !/^\d+[\d\.\/-]*$/.test(text);
    // Should not contain excessive punctuation or mixed scripts
    const punctuationCount = (text.match(/[^\w\s]/g) || []).length;
    const notExcessivePunctuation = punctuationCount < text.length * 0.3;

    // Should have at least 3 consecutive readable characters
    const hasConsecutiveReadable = /[a-zA-Zก-๙]{3,}/.test(text);

    return hasLetters && notPrice && notBarcode && notExcessivePunctuation && hasConsecutiveReadable && isReadable(text);
  };

  // Look for the first readable line that appears to be a product name
  // IMPORTANT: Skip metadata lines that look like products (dates, weight lines, etc)
  for (const line of lines) {
    // Skip if line is too short
    if (line.length < 5) continue;

    // Skip if line is purely numeric or looks like a date/barcode
    if (/^\d+[\d\.\/-]*$/.test(line)) continue;
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(line)) continue;

    // Skip common metadata patterns - CRITICAL FOR THAI LABELS
    if (/^(mfd|exp|best before|use by|lot|batch)/i.test(line)) continue;
    if (/ปริมาณสุทธิ|น้ำหนักสุทธิ|ราคา|ราคารวม/i.test(line)) continue; // Weight/price lines
    if (/วันที่ผลิต|ควรบริโภคก่อน|best\s*before|use\s*by|วันหมดอายุ/i.test(line)) continue; // Date lines
    if (/makro|food service|^temp|^storage|คำแนะนำ|ผลิต\/จำหน่าย|อุณหภูมิ/i.test(line)) continue;

    // Check if this looks like a product name
    if (looksLikeProductName(line)) {
      // Clean unit suffixes from product name
      let cleanName = line.trim();
      cleanName = cleanName.replace(/\s*(KG\.?|G\.?|ML\.?|L\.?|กก\.?|กรัม)$/i, '').trim();
      cleanName = cleanName.replace(/(KG\.?|G\.?|ML\.?|L\.?)$/i, '').trim();
      productName = cleanName;
      console.log(`🔍 Found product name (headline, cleaned): ${productName}`);
      break;
    }
  }

  // Extract quantity and unit - specifically look near "ปริมาณสุทธิ" (Net Quantity)
  let quantity = 1;
  let unit = 'piece';

  // First, try to find "ปริมาณสุทธิ" or "Net" labels
  const netQuantityPatterns = [
    /ปริมาณสุทธิ[:\s]*(\d+(?:\.\d+)?)\s*(kg|kilogram|กิโลกรัม|g|gram|กรัม|ml|milliliter|มิลลิลิตร|l|liter|ลิตร|piece|pcs|ชิ้น|bottle|ขวด|pack|แพค)/i,
    /net\s*(?:weight|quantity|content)[:\s]*(\d+(?:\.\d+)?)\s*(kg|kilogram|g|gram|ml|milliliter|l|liter|piece|pcs|bottle|pack)/i,
  ];

  let quantityFound = false;
  for (const pattern of netQuantityPatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      quantity = parseFloat(match[1]);
      const unitText = match[2].toLowerCase();

      // Map unit variations to standard units
      if (/kg|kilogram|กิโลกรัม/.test(unitText)) unit = 'kg';
      else if (/^(g|gram|กรัม)$/.test(unitText)) unit = 'g';
      else if (/ml|milliliter|มิลลิลิตร/.test(unitText)) unit = 'ml';
      else if (/^(l|liter|ลิตร)$/.test(unitText)) unit = 'L';
      else if (/piece|pcs|ชิ้น/.test(unitText)) unit = 'piece';
      else if (/bottle|ขวด/.test(unitText)) unit = 'bottle';
      else if (/pack|แพค/.test(unitText)) unit = 'pack';

      console.log(`🔍 Found quantity from net quantity label: ${quantity} ${unit}`);
      quantityFound = true;
      break;
    }
  }

  // Fallback: Look for weight/quantity in barcode lines (common in retail labels)
  if (!quantityFound) {
    // Pattern: barcode/number followed by weight and unit
    const barcodeWeightPattern = /(\d{2,})\/\d+\s+(\d+\.\d+)\s+(\w+)/;
    const match = ocrText.match(barcodeWeightPattern);
    if (match) {
      const weightValue = parseFloat(match[2]);
      const unitText = match[3].toLowerCase();

      // Common unit mappings
      if (weightValue > 0) {
        quantity = weightValue;
        if (/kg|kl|11/.test(unitText)) unit = 'kg';
        else if (/g|gm/.test(unitText)) unit = 'g';
        else if (/ml/.test(unitText)) unit = 'ml';
        else if (/20|l/.test(unitText)) unit = 'kg'; // "20." often means kg in retail

        console.log(`🔍 Found quantity from barcode line: ${quantity} ${unit}`);
      }
    }
  }

  // Find all dates in the text first (DD.MM.YYYY or DD/MM/YYYY format)
  const allDates = [];
  const dateRegex = /\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})\b/g;
  let dateMatch;
  while ((dateMatch = dateRegex.exec(ocrText)) !== null) {
    try {
      let day = parseInt(dateMatch[1]);
      let month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);

      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      // Validate date
      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month - 1, day);
        const context = ocrText.substring(Math.max(0, dateMatch.index - 20), dateMatch.index);
        allDates.push({ date, context, fullMatch: dateMatch[0] });
      }
    } catch (e) {
      console.error('Date parsing error:', e);
    }
  }

  console.log(`🔍 Found ${allDates.length} dates in text`);

  // Now classify dates as MFD or EXP based on context
  let expiryDate = null;
  let manufacturingDate = null;

  for (const { date, context, fullMatch } of allDates) {
    const contextLower = context.toLowerCase();

    // Check if context indicates MFD
    if (/mfd|manufactured|production|วันที่ผลิต/.test(contextLower)) {
      if (!manufacturingDate) {
        manufacturingDate = date;
        console.log(`🔍 Found MFD (from context): ${date.toLocaleDateString()}`);
      }
    }
    // Check if context indicates EXP - includes Thai text "ควรบริโภคก่อน"
    else if (/exp|expiry|best\s*before|use\s*by|วันหมดอายุ|ควรบริโภคก่อน/.test(contextLower)) {
      if (!expiryDate) {
        expiryDate = date;
        console.log(`🔍 Found EXP (from context): ${date.toLocaleDateString()}`);
      }
    }
  }

  // If we have dates but no context, use heuristics:
  // - If 2 dates found and no context, first is likely MFD, second is likely EXP
  if (allDates.length === 2 && !manufacturingDate && !expiryDate) {
    // Sort by date value
    allDates.sort((a, b) => a.date - b.date);
    manufacturingDate = allDates[0].date;
    expiryDate = allDates[1].date;
    console.log(`🔍 Found MFD (heuristic - earlier date): ${manufacturingDate.toLocaleDateString()}`);
    console.log(`🔍 Found EXP (heuristic - later date): ${expiryDate.toLocaleDateString()}`);
  }
  // If only one date and no context, assume it's expiry
  else if (allDates.length === 1 && !manufacturingDate && !expiryDate) {
    expiryDate = allDates[0].date;
    console.log(`🔍 Found date (assumed EXP): ${expiryDate.toLocaleDateString()}`);
  }

  return {
    name: productName || 'Product',
    quantity,
    unit,
    expiryDate,
    manufacturingDate,
  };
};

/**
 * Calculate OCR quality score to help users know if they should retake
 */
const calculateOCRQuality = (rawText, parsedData) => {
  let score = 100;
  const issues = [];

  // Bonus for structured label detection
  if (parsedData.structured) {
    console.log('✅ Structured label detected - applying bonus');
  }

  // Check if product name looks generic or garbled
  if (parsedData.name === 'Product') {
    score -= 30;
    issues.push('Product name not detected');
  } else {
    // Check for Cyrillic/garbled characters in product name
    const garbledChars = parsedData.name.match(/[А-Яа-яЁёЪъЬьЭэ@#$%^&*(){}[\]|\\<>]/g) || [];
    if (garbledChars.length > 0) {
      score -= 20;
      issues.push('Product name contains unreadable characters');
    }

    // Check if name is too short
    if (parsedData.name.length < 3) {
      score -= 15;
      issues.push('Product name too short');
    }
  }

  // Check if dates were found (more lenient for structured labels)
  if (!parsedData.expiryDate && !parsedData.manufacturingDate) {
    score -= parsedData.structured ? 15 : 20;
    issues.push('No dates detected');
  } else if (parsedData.manufacturingDate && parsedData.expiryDate) {
    // Bonus for having both dates (common in structured labels)
    score += 5;
    console.log('✅ Both MFG and BBF dates found');
  }

  // Check if quantity is default
  if (parsedData.quantity === 1 && parsedData.unit === 'piece') {
    score -= parsedData.structured ? 5 : 10;
    issues.push('Weight not detected');
  }

  // Check overall text quality
  const totalChars = rawText.length;
  const readableChars = (rawText.match(/[a-zA-Z0-9\s\-.,ก-๙]/g) || []).length;
  const readableRatio = readableChars / totalChars;

  if (readableRatio < 0.6) {
    score -= 20;
    issues.push('Low text quality - try better lighting');
  } else if (readableRatio > 0.85) {
    score += 5; // Bonus for very clean OCR
  }

  // Determine confidence level
  let confidence = 'high';
  if (score < 70) confidence = 'medium';
  if (score < 50) confidence = 'low';

  return {
    score: Math.max(0, Math.min(100, score)), // Clamp between 0-100
    confidence,
    issues,
  };
};

/**
 * Process image with Azure Document Intelligence OCR
 */
exports.parseImage = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'Azure Document Intelligence is not configured',
      });
    }

    const { language = 'en', base64Image } = req.body;
    let imageBuffer;

    // Handle base64 string from React Native (preferred method)
    if (base64Image) {
      console.log(`📸 Received base64 image from client`);
      try {
        imageBuffer = Buffer.from(base64Image, 'base64');
        console.log(`📦 Decoded base64 to buffer: ${imageBuffer.length} bytes`);
      } catch (err) {
        console.error('Base64 decode error:', err);
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 image data',
        });
      }
    }
    // Fall back to file upload (for compatibility)
    else if (req.file) {
      console.log(`📸 Received image file from client`);
      imageBuffer = req.file.buffer;
    }
    // Neither base64 nor file provided
    else {
      return res.status(400).json({
        success: false,
        error: 'No image provided',
      });
    }

    // Call Azure Document Intelligence OCR API
    const headers = {
      'Ocp-Apim-Subscription-Key': AZURE_DI_KEY,
      'Content-Type': 'application/octet-stream',
    };

    // Ensure endpoint ends without slash, then append path
    let endpoint = AZURE_DI_ENDPOINT;
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    // Azure Form Recognizer API - understands document structure
    // Using API version 2023-07-31 (formrecognizer path is compatible with this version)
    // Note: API version 2024-11-30 requires a different endpoint path and causes conflicts
    const apiVersion = '2023-07-31';
    const ocrUrl = `${endpoint}/formrecognizer/documentmodels/prebuilt-read:analyze?api-version=${apiVersion}`;

    console.log(`📸 Sending image to Azure Document Intelligence OCR...`);
    console.log(`🔗 OCR URL: ${ocrUrl}`);
    console.log(`🔑 Using API Key: ${AZURE_DI_KEY.substring(0, 10)}...`);

    console.log(`📦 Image Buffer Size: ${imageBuffer.length} bytes`);
    console.log(`📦 Image Buffer Type: ${typeof imageBuffer}`);

    const response = await axios.post(ocrUrl, imageBuffer, {
      headers: {
        ...headers,
        'Content-Length': imageBuffer.length,
      },
      timeout: 30000,
      maxRedirects: 0,
    });

    // Extract operation location for polling
    const operationLocation = response.headers['operation-location'];

    if (!operationLocation) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process image with Azure Document Intelligence',
      });
    }

    // Poll for results
    let ocrResult = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_DI_KEY,
        },
      });

      if (statusResponse.data.status === 'succeeded') {
        ocrResult = statusResponse.data;
        break;
      } else if (statusResponse.data.status === 'failed') {
        return res.status(500).json({
          success: false,
          error: 'OCR processing failed',
        });
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!ocrResult) {
      return res.status(500).json({
        success: false,
        error: 'OCR processing timeout',
      });
    }

    // Extract all text from the Document Intelligence result
    let extractedText = '';

    console.log(`📊 Full OCR Response Structure:`, JSON.stringify(ocrResult, null, 2).substring(0, 500));

    // Try multiple possible response structures
    if (ocrResult.analyzeResult) {
      // Try newer format: paragraphs (Document Intelligence v2024+)
      if (ocrResult.analyzeResult.paragraphs && ocrResult.analyzeResult.paragraphs.length > 0) {
        console.log(`🔍 Extracting from paragraphs...`);
        for (const paragraph of ocrResult.analyzeResult.paragraphs) {
          extractedText += (paragraph.content || '') + '\n';
        }
      }
      // Try older format: readResults (Form Recognizer)
      else if (ocrResult.analyzeResult.readResults && ocrResult.analyzeResult.readResults.length > 0) {
        console.log(`🔍 Extracting from readResults...`);
        for (const page of ocrResult.analyzeResult.readResults) {
          for (const line of page.lines) {
            extractedText += line.text + '\n';
          }
        }
      }
      // Try pages format
      else if (ocrResult.analyzeResult.pages && ocrResult.analyzeResult.pages.length > 0) {
        console.log(`🔍 Extracting from pages...`);
        for (const page of ocrResult.analyzeResult.pages) {
          if (page.lines) {
            for (const line of page.lines) {
              extractedText += line.content + '\n';
            }
          }
        }
      }
    }

    console.log(`✅ OCR extraction complete`);
    console.log(`📝 Full OCR text:\n${extractedText}`);
    console.log(`📝 Text length: ${extractedText.length} characters`);

    // Parse the extracted text
    const parsedData = parseOCRText(extractedText, language);

    // Calculate quality score based on OCR results
    const qualityScore = calculateOCRQuality(extractedText, parsedData);
    console.log(`📊 OCR Quality Score: ${qualityScore.score}/100`);

    res.json({
      success: true,
      data: {
        rawText: extractedText,
        parsed: {
          name: parsedData.name,
          quantity: parsedData.quantity,
          unit: parsedData.unit,
          expiryDate: parsedData.expiryDate,
          manufacturingDate: parsedData.manufacturingDate,
        },
        quality: {
          score: qualityScore.score,
          confidence: qualityScore.confidence,
          issues: qualityScore.issues,
        },
      },
    });
  } catch (error) {
    console.error('OCR Error:', error.message);

    // Log detailed error info
    if (error.response) {
      console.error('Azure API Response Status:', error.response.status);
      console.error('Azure API Response Data:', error.response.data);
      console.error('Azure API Response Headers:', error.response.headers);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process image',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        status: error.response?.status,
        data: error.response?.data,
      } : undefined,
    });
  }
};

/**
 * Health check for OCR service
 */
exports.health = (req, res) => {
  res.json({
    success: true,
    configured: isConfigured(),
    service: 'Azure Document Intelligence',
    endpoint: AZURE_DI_ENDPOINT,
  });
};
