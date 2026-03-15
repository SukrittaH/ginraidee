const axios = require('axios');

// Azure Document Intelligence API configuration
const AZURE_DI_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'https://your-resource.cognitiveservices.azure.com/';
const AZURE_DI_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

// Validate configuration
const isConfigured = () => {
  return !!(AZURE_DI_ENDPOINT && AZURE_DI_KEY);
};

// ─────────────────────────────────────────────
// Helper Functions for parseStructuredLabel
// ─────────────────────────────────────────────

/**
 * Find MFG and BBF line indices in OCR text
 */
const findMetadataIndices = (lines) => {
  let mfgIndex = -1;
  let bbfIndex = -1;

  lines.forEach((line, i) => {
    const lineLower = line.toLowerCase();
    if (/^mfg[:\s]/i.test(line) || /วันที่ผลิต/i.test(line)) {
      mfgIndex = i;
    }
    if (/^bbf[:\s]/i.test(line) || /^exp[:\s]/i.test(line) || /best\s*before|ควรบริโภคก่อน|วันหมดอายุ/i.test(lineLower)) {
      bbfIndex = i;
    }
  });

  return { mfgIndex, bbfIndex };
};

/**
 * Find product name candidates from first few lines
 */
const findProductLineCandidates = (lines) => {
  const productLines = [];
  const skipPatterns = [
    /^mfg[:\s]/i,
    /^bbf[:\s]/i,
    /^exp[:\s]/i,
    /^\d+[\d\.\/-]*$/,
    /น้ำหนักสุทธิ|ปริมาณสุทธิ|วันที่ผลิต|ควรบริโภคก่อน|ราคา/i,
    /^\d{1,2}\.\d{1,2}\.\d{2,4}/,
  ];

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (skipPatterns.some(pattern => pattern.test(line))) continue;

    const hasThaiChars = /[ก-๙]/.test(line);
    const hasEnglishChars = /[a-zA-Z]/.test(line);
    const hasMinLength = line.length >= 3;
    const numberRatio = (line.match(/\d/g) || []).length / line.length;

    if (numberRatio > 0.5) continue;
    if (hasMinLength && (hasThaiChars || hasEnglishChars)) {
      productLines.push({ line, hasThaiChars, hasEnglishChars, index: i });
    }
  }

  return productLines;
};

/**
 * Parse bilingual product name (Thai + English on one line)
 */
const parseBilingualProductName = (productLines) => {
  if (productLines.length < 1) return { thai: null, english: null };

  const firstLine = productLines[0].line;
  const hasThaiChars = /[ก-๙]/.test(firstLine);
  const hasEnglishChars = /[a-zA-Z]/.test(firstLine);

  if (hasThaiChars && hasEnglishChars) {
    const parts = firstLine.match(/([ก-๙\s\.]+)\s+([A-Za-z\s]+)/);
    if (parts && parts.length >= 3) {
      const thai = parts[1].trim();
      let english = parts[2].trim();
      english = english.replace(/\s*(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
      return { thai, english };
    }
  }

  return null;
};

/**
 * Parse single-language product names from multiple lines
 */
const parseSingleLanguageNames = (productLines) => {
  let thai = null;
  let english = null;

  for (const { line, hasThaiChars, hasEnglishChars } of productLines) {
    if (!thai && hasThaiChars) {
      thai = line.trim();
    }
    if (!english && hasEnglishChars) {
      let cleanName = line.trim();
      cleanName = cleanName.replace(/\s*(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
      cleanName = cleanName.replace(/(KG|G|ML|L)$/i, '').trim();
      english = cleanName;
    }
  }

  return { thai, english };
};

/**
 * Clean unit suffixes from product name
 */
const cleanProductName = (name) => {
  let clean = name.trim();
  clean = clean.replace(/\s*(KG\.?|G\.?|ML\.?|L\.?|กก\.?|กรัม)$/i, '').trim();
  clean = clean.replace(/(KG\.?|G\.?|ML\.?|L\.?)$/i, '').trim();
  return clean;
};

/**
 * Map unit text to standard format
 */
const mapUnitToStandard = (unitText) => {
  const text = unitText.toLowerCase();
  if (/ก\.ก\.|กก\.?|kg|กิโลกรัม/.test(text)) return 'kg';
  if (/^g$|กรัม/.test(text)) return 'g';
  if (/ml|มิลลิลิตร/.test(text)) return 'ml';
  if (/^l$|ลิตร/.test(text)) return 'L';
  return 'piece';
};

/**
 * Extract weight from net weight pattern
 */
const extractWeightFromNetPattern = (lines) => {
  const netWeightPattern = /น้ำหนักสุทธิ\s*(\d+(?:\.\d+)?)\s*(ก\.ก\.|กก\.?|g|kg|กรัม|กิโลกรัม|ml|l)/i;

  for (const line of lines) {
    const match = line.match(netWeightPattern);
    if (match) {
      const quantity = parseFloat(match[1]);
      const unit = mapUnitToStandard(match[2]);
      return { quantity, unit };
    }
  }

  return null;
};

/**
 * Check if weight value is reasonable
 */
const isWeightReasonable = (quantity, unit) => {
  const limits = {
    kg: { min: 0.01, max: 50 },
    g: { min: 0, max: 50000 },
    ml: { min: 0, max: 50000 },
    L: { min: 0, max: 50 },
  };

  const limit = limits[unit];
  return limit && quantity >= limit.min && quantity <= limit.max;
};

/**
 * Extract weight from garbled OCR patterns
 */
const extractWeightFromGarbledPatterns = (lines) => {
  const garbledUnitPatterns = ['nn.', '11.', '1n.', 'ln.'];

  for (const line of lines) {
    const garbledMatch = line.match(/(\d+\.\d{1,3})\s*([a-z]{1,2}\.)/i);
    if (garbledMatch) {
      const potentialQty = parseFloat(garbledMatch[1]);
      const garbledUnit = garbledMatch[2].toLowerCase();

      if (potentialQty > 0 && potentialQty <= 50 && garbledUnitPatterns.includes(garbledUnit)) {
        return { quantity: potentialQty, unit: 'kg' };
      }
    }
  }

  return null;
};

/**
 * Extract weight using general weight patterns
 */
const extractWeightFromGeneralPatterns = (lines) => {
  const weightPatterns = [
    /(\d+(?:\.\d+)?)\s*(ก\.ก\.)/i,
    /(\d+(?:\.\d+)?)\s*(กก\.?)/i,
    /(\d+(?:\.\d+)?)\s*(g|kg|ml|l|กรัม|กิโลกรัม)\b/i,
    /(\d+(?:\.\d+)?)\s*(กรัม|กิโลกรัม|มิลลิลิตร|ลิตร)/i,
    /(\d+(?:\.\d+)?)(g|kg|ml|l)\b/i,
    /(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/i,
  ];

  for (const line of lines) {
    for (const pattern of weightPatterns) {
      const match = line.match(pattern);
      if (match) {
        const potentialQty = parseFloat(match[1]);
        const unitText = match[2].toLowerCase();
        const unit = mapUnitToStandard(unitText);

        if (isWeightReasonable(potentialQty, unit)) {
          return { quantity: potentialQty, unit };
        }
      }
    }
  }

  return null;
};

/**
 * Parse structured retail label format
 */
const parseStructuredLabel = (lines, ocrText) => {
  console.log('🏷️ Attempting structured label parsing...');

  const { mfgIndex, bbfIndex } = findMetadataIndices(lines);
  console.log(`🔍 Found MFG at line ${mfgIndex}, BBF at line ${bbfIndex}`);

  // Extract product names
  const productLines = findProductLineCandidates(lines);
  const bilingualName = parseBilingualProductName(productLines);

  let productNameThai = null;
  let productNameEnglish = null;

  if (bilingualName) {
    productNameThai = bilingualName.thai;
    productNameEnglish = bilingualName.english;
    console.log(`🔍 Bilingual product name: Thai="${productNameThai}", Eng="${productNameEnglish}"`);
  } else {
    const singleLangNames = parseSingleLanguageNames(productLines);
    productNameThai = singleLangNames.thai;
    productNameEnglish = singleLangNames.english;
  }

  // Extract weight - try net pattern first
  let quantity = 1;
  let unit = 'piece';

  let weightResult = extractWeightFromNetPattern(lines);
  if (!weightResult) {
    weightResult = extractWeightFromGarbledPatterns(lines);
  }
  if (!weightResult) {
    weightResult = extractWeightFromGeneralPatterns(lines);
  }

  if (weightResult) {
    quantity = weightResult.quantity;
    unit = weightResult.unit;
  }

  // Extract MFG date
  let manufacturingDate = null;
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
  let expiryDate = null;
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

  const productName = productNameEnglish || productNameThai || 'Product';

  return {
    name: productName,
    quantity,
    unit,
    expiryDate,
    manufacturingDate,
    structured: true,
  };
};

// ─────────────────────────────────────────────
// Helper Functions for parseOCRText
// ─────────────────────────────────────────────

/**
 * Check if string is mostly readable
 */
const isReadable = (text) => {
  const readable = text.match(/[a-zA-Z0-9\s\-.,ก-๙]/g) || [];
  const total = text.length;

  const garbledChars = text.match(/[А-Яа-яЁёЪъмьЭэ@#$%^&*(){}[\]|\\<>]/g) || [];
  const hasGarbledChars = garbledChars.length > text.length * 0.2;

  const readableRatio = readable.length / total;
  return readableRatio >= 0.8 && !hasGarbledChars;
};

/**
 * Check if text looks like a product name
 */
const looksLikeProductName = (text) => {
  const hasLetters = /[a-zA-Zก-๙]/.test(text);
  const notPrice = !/^\d+\.\d{2}$/.test(text);
  const notBarcode = !/^\d+[\d\.\/-]*$/.test(text);
  const punctuationCount = (text.match(/[^\w\s]/g) || []).length;
  const notExcessivePunctuation = punctuationCount < text.length * 0.3;
  const hasConsecutiveReadable = /[a-zA-Zก-๙]{3,}/.test(text);

  return hasLetters && notPrice && notBarcode && notExcessivePunctuation && hasConsecutiveReadable && isReadable(text);
};

/**
 * Extract product name from text
 */
const extractProductNameFromText = (lines) => {
  const skipPatterns = [
    /^(mfd|exp|best before|use by|lot|batch)/i,
    /ปริมาณสุทธิ|น้ำหนักสุทธิ|ราคา|ราคารวม/i,
    /วันที่ผลิต|ควรบริโภคก่อน|best\s*before|use\s*by|วันหมดอายุ/i,
    /makro|food service|^temp|^storage|คำแนะนำ|ผลิต\/จำหน่าย|อุณหภูมิ/i,
    /^\d+[\d\.\/-]*$/,
    /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
  ];

  for (const line of lines) {
    if (line.length < 5) continue;
    if (skipPatterns.some(pattern => pattern.test(line))) continue;

    if (looksLikeProductName(line)) {
      return cleanProductName(line);
    }
  }

  return 'Product';
};

/**
 * Extract quantity from net patterns
 */
const extractQuantityFromNetPatterns = (ocrText) => {
  const patterns = [
    /ปริมาณสุทธิ[:\s]*(\d+(?:\.\d+)?)\s*(kg|kilogram|กิโลกรัม|g|gram|กรัม|ml|milliliter|มิลลิลิตร|l|liter|ลิตร|piece|pcs|ชิ้น|bottle|ขวด|pack|แพค)/i,
    /net\s*(?:weight|quantity|content)[:\s]*(\d+(?:\.\d+)?)\s*(kg|kilogram|g|gram|ml|milliliter|l|liter|piece|pcs|bottle|pack)/i,
  ];

  for (const pattern of patterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const quantity = parseFloat(match[1]);
      const unit = mapUnitToStandard(match[2]);
      return { quantity, unit };
    }
  }

  return null;
};

/**
 * Extract quantity from barcode patterns
 */
const extractQuantityFromBarcodePatterns = (ocrText) => {
  const pattern = /(\d{2,})\/\d+\s+(\d+\.\d+)\s+(\w+)/;
  const match = ocrText.match(pattern);

  if (match) {
    const weightValue = parseFloat(match[2]);
    const unitText = match[3].toLowerCase();

    if (weightValue > 0) {
      if (/kg|kl|11/.test(unitText)) return { quantity: weightValue, unit: 'kg' };
      if (/g|gm/.test(unitText)) return { quantity: weightValue, unit: 'g' };
      if (/ml/.test(unitText)) return { quantity: weightValue, unit: 'ml' };
      if (/20|l/.test(unitText)) return { quantity: weightValue, unit: 'kg' };
    }
  }

  return null;
};

/**
 * Extract and classify all dates
 */
const extractAndClassifyDates = (ocrText) => {
  const allDates = [];
  const dateRegex = /\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})\b/g;
  let dateMatch;

  while ((dateMatch = dateRegex.exec(ocrText)) !== null) {
    try {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);

      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

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

  let expiryDate = null;
  let manufacturingDate = null;

  for (const { date, context, fullMatch } of allDates) {
    const contextLower = context.toLowerCase();

    if (/mfd|manufactured|production|วันที่ผลิต/.test(contextLower)) {
      if (!manufacturingDate) {
        manufacturingDate = date;
        console.log(`🔍 Found MFD (from context): ${date.toLocaleDateString()}`);
      }
    } else if (/exp|expiry|best\s*before|use\s*by|วันหมดอายุ|ควรบริโภคก่อน/.test(contextLower)) {
      if (!expiryDate) {
        expiryDate = date;
        console.log(`🔍 Found EXP (from context): ${date.toLocaleDateString()}`);
      }
    }
  }

  // Heuristic: if 2 dates found and no context, first is likely MFD, second is likely EXP
  if (allDates.length === 2 && !manufacturingDate && !expiryDate) {
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

  return { expiryDate, manufacturingDate };
};

/**
 * Parse OCR result to extract product information
 */
const parseOCRText = (ocrText, language = 'th') => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

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

  // Extract product name
  const productName = extractProductNameFromText(lines);

  // Extract quantity - try net pattern first
  let quantity = 1;
  let unit = 'piece';

  let quantityResult = extractQuantityFromNetPatterns(ocrText);
  if (!quantityResult) {
    quantityResult = extractQuantityFromBarcodePatterns(ocrText);
  }

  if (quantityResult) {
    quantity = quantityResult.quantity;
    unit = quantityResult.unit;
  }

  // Extract and classify dates
  const { expiryDate, manufacturingDate } = extractAndClassifyDates(ocrText);

  return {
    name: productName || 'Product',
    quantity,
    unit,
    expiryDate,
    manufacturingDate,
  };
};

/**
 * Calculate OCR quality score
 */
const calculateOCRQuality = (rawText, parsedData) => {
  let score = 100;
  const issues = [];

  if (parsedData.structured) {
    console.log('✅ Structured label detected - applying bonus');
  }

  if (parsedData.name === 'Product') {
    score -= 30;
    issues.push('Product name not detected');
  } else {
    const garbledChars = parsedData.name.match(/[А-Яа-яЁёЪъмьЭэ@#$%^&*(){}[\]|\\<>]/g) || [];
    if (garbledChars.length > 0) {
      score -= 20;
      issues.push('Product name contains unreadable characters');
    }

    if (parsedData.name.length < 3) {
      score -= 15;
      issues.push('Product name too short');
    }
  }

  if (!parsedData.expiryDate && !parsedData.manufacturingDate) {
    score -= parsedData.structured ? 15 : 20;
    issues.push('No dates detected');
  } else if (parsedData.manufacturingDate && parsedData.expiryDate) {
    score += 5;
    console.log('✅ Both MFG and BBF dates found');
  }

  if (parsedData.quantity === 1 && parsedData.unit === 'piece') {
    score -= parsedData.structured ? 5 : 10;
    issues.push('Weight not detected');
  }

  const totalChars = rawText.length;
  const readableChars = (rawText.match(/[a-zA-Z0-9\s\-.,ก-๙]/g) || []).length;
  const readableRatio = readableChars / totalChars;

  if (readableRatio < 0.6) {
    score -= 20;
    issues.push('Low text quality - try better lighting');
  } else if (readableRatio > 0.85) {
    score += 5;
  }

  let confidence = 'high';
  if (score < 70) confidence = 'medium';
  if (score < 50) confidence = 'low';

  return {
    score: Math.max(0, Math.min(100, score)),
    confidence,
    issues,
  };
};

/**
 * Extract text from Azure Document Intelligence response
 */
const extractTextFromAzureResponse = (ocrResult) => {
  let extractedText = '';

  if (!ocrResult.analyzeResult) {
    return extractedText;
  }

  const analyzeResult = ocrResult.analyzeResult;

  if (analyzeResult.paragraphs && analyzeResult.paragraphs.length > 0) {
    console.log('🔍 Extracting from paragraphs...');
    for (const paragraph of analyzeResult.paragraphs) {
      extractedText += (paragraph.content || '') + '\n';
    }
  } else if (analyzeResult.readResults && analyzeResult.readResults.length > 0) {
    console.log('🔍 Extracting from readResults...');
    for (const page of analyzeResult.readResults) {
      for (const line of page.lines) {
        extractedText += line.text + '\n';
      }
    }
  } else if (analyzeResult.pages && analyzeResult.pages.length > 0) {
    console.log('🔍 Extracting from pages...');
    for (const page of analyzeResult.pages) {
      if (page.lines) {
        for (const line of page.lines) {
          extractedText += line.content + '\n';
        }
      }
    }
  }

  return extractedText;
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

    if (base64Image) {
      console.log('📸 Received base64 image from client');
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
    } else if (req.file) {
      console.log('📸 Received image file from client');
      imageBuffer = req.file.buffer;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No image provided',
      });
    }

    const headers = {
      'Ocp-Apim-Subscription-Key': AZURE_DI_KEY,
      'Content-Type': 'application/octet-stream',
    };

    let endpoint = AZURE_DI_ENDPOINT;
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    const apiVersion = '2023-07-31';
    const ocrUrl = `${endpoint}/formrecognizer/documentmodels/prebuilt-read:analyze?api-version=${apiVersion}`;

    console.log('📸 Sending image to Azure Document Intelligence OCR...');
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

    const operationLocation = response.headers['operation-location'];

    if (!operationLocation) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process image with Azure Document Intelligence',
      });
    }

    let ocrResult = null;
    const maxAttempts = 30;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
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

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!ocrResult) {
      return res.status(500).json({
        success: false,
        error: 'OCR processing timeout',
      });
    }

    const extractedText = extractTextFromAzureResponse(ocrResult);

    console.log(`📊 Full OCR Response Structure:`, JSON.stringify(ocrResult, null, 2).substring(0, 500));
    console.log('✅ OCR extraction complete');
    console.log(`📝 Full OCR text:\n${extractedText}`);
    console.log(`📝 Text length: ${extractedText.length} characters`);

    const parsedData = parseOCRText(extractedText, language);
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
