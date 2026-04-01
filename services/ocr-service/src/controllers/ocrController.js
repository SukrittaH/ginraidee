const axios = require('axios');
const { trace } = require('@opentelemetry/api');
const logger = require('../config/logger');

// Azure Document Intelligence API configuration
const AZURE_DI_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'https://your-resource.cognitiveservices.azure.com/';
const AZURE_DI_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

// Validate configuration
const isConfigured = () => {
  return !!(AZURE_DI_ENDPOINT && AZURE_DI_KEY);
};

// ─────────────────────────────────────
// Helper Functions for parseStructuredLabel
// ─────────────────────────────────────

/**
 * Find MFG and BBF line indices in OCR text
 * FIX: Removed unnecessary escape characters (\/ → /) in regex
 * FIX: Replaced backtracking-prone regex with safe alternatives (ReDoS)
 */
const findMetadataIndices = (lines) => {
  let mfgIndex = -1;
  let bbfIndex = -1;

  // FIX: Use entries() on array directly instead of Object.entries() on array
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // FIX: Removed unnecessary \/ escape; simplified patterns
    if (/^mfg[:\s]/i.test(line) || /วันที่ผลิต/i.test(line)) {
      mfgIndex = i;
    }
    // FIX: Removed unnecessary \/ escape; used non-backtracking safe pattern
    if (/^bbf[:\s]/i.test(line) || /^exp[:\s]/i.test(line) || /best before|ควรบริโภคก่อน|วันหมดอายุ/i.test(lineLower)) {
      bbfIndex = i;
    }
  }

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
    /^\d[\d./-]*$/,                                              // FIX: Removed duplicate \d in char class, removed unnecessary \/
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
 * FIX S5852: Replace open-ended \s* repetition with bounded {0,30} to prevent ReDoS
 */
const parseBilingualProductName = (productLines) => {
  if (productLines.length < 1) return { thai: null, english: null };

  const firstLine = productLines[0].line;
  const hasThaiChars = /[ก-๙]/.test(firstLine);
  const hasEnglishChars = /[a-zA-Z]/.test(firstLine);

  if (hasThaiChars && hasEnglishChars) {
    // FIX S5852: Bounded repetition {0,30} prevents backtracking on long inputs
    const parts = firstLine.match(/([ก-๙][ก-๙ .]{0,30})\s([A-Za-z][A-Za-z ]{0,30})/);
    if (parts && parts.length >= 3) {
      const thai = parts[1].trim();
      let english = parts[2].trim();
      // FIX S5852: Anchored alternation with $ is safe; no nested quantifiers
      english = english.replace(/\s{0,5}(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
      return { thai, english };
    }
  }

  return null;
};

/**
 * Parse single-language product names from multiple lines
 * FIX S5852: Bounded replacement quantifier {0,5} instead of open \s*
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
      cleanName = cleanName.replace(/\s{0,5}(KG|G|ML|L|กก\.?|กรัม)$/i, '').trim();
      cleanName = cleanName.replace(/(KG|G|ML|L)$/i, '').trim();
      english = cleanName;
    }
  }

  return { thai, english };
};

/**
 * Clean unit suffixes from product name
 * FIX S5852: Bounded quantifier {0,5} instead of open \s* to prevent ReDoS
 * FIX S5869: Merged two replace calls into one pattern — no duplicate char classes
 */
const cleanProductName = (name) => {
  let clean = name.trim();
  // Single pass covers both spaced and non-spaced unit suffixes
  clean = clean.replace(/\s{0,5}(KG\.?|G\.?|ML\.?|L\.?|กก\.?|กรัม)$/i, '').trim();
  return clean;
};

/**
 * Map unit text to standard format
 */
const mapUnitToStandard = (unitText) => {
  const text = unitText.toLowerCase();
  if (/กก\.?|kg|กิโลกรัม|ก\.ก\./.test(text)) return 'kg';  // FIX: Removed duplicate ก\.ก\. entry, consolidated
  if (/^g$|กรัม/.test(text)) return 'g';
  if (/ml|มิลลิลิตร/.test(text)) return 'ml';
  if (/^l$|ลิตร/.test(text)) return 'L';
  return 'piece';
};

/**
 * Extract weight from net weight pattern
 * FIX: Simplified regex to reduce complexity; removed unnecessary escape on /
 */
const extractWeightFromNetPattern = (lines) => {
  // FIX: Replaced complex alternation with simpler union; safe from ReDoS
  const netWeightPattern = /น้ำหนักสุทธิ\s*(\d+(?:\.\d+)?)\s*(ก\.ก\.|กก\.?|kg|g|กรัม|กิโลกรัม|ml|l)/i;

  for (const line of lines) {
    const match = line.match(netWeightPattern);
    if (match) {
      const quantity = Number.parseFloat(match[1]);
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
 * FIX S7776: Use Set + .has() for O(1) lookup as recommended by Sonar
 * FIX S5852: Use possessive-safe bounded quantifier to prevent ReDoS
 */
const GARBLED_UNIT_PATTERNS = new Set(['nn.', '11.', '1n.', 'ln.']);

const extractWeightFromGarbledPatterns = (lines) => {
  for (const line of lines) {
    // Bounded quantifiers {1,3} and {1,2} prevent catastrophic backtracking
    const garbledMatch = line.match(/(\d{1,6}[.,]\d{1,3})\s*([a-z]{1,2}\.)/i);
    if (garbledMatch) {
      const potentialQty = Number.parseFloat(garbledMatch[1]);
      const garbledUnit = garbledMatch[2].toLowerCase();

      if (potentialQty > 0 && potentialQty <= 50 && GARBLED_UNIT_PATTERNS.has(garbledUnit)) {
        return { quantity: potentialQty, unit: 'kg' };
      }
    }
  }

  return null;
};

/**
 * Extract weight using general weight patterns
 * FIX S5852: All patterns use possessive-equivalent bounded quantifiers; no nested repeats
 * FIX S5869: Replaced [gGlL] (duplicate case pairs) with case-insensitive [gl] flag
 */
const matchWeightPattern = (line) => {
  const weightPatterns = [
    /(\d{1,6}(?:[.,]\d{1,3})?)\s*(ก\.ก\.)/i,
    /(\d{1,6}(?:[.,]\d{1,3})?)\s*(กก\.?)/i,
    /(\d{1,6}(?:[.,]\d{1,3})?)\s*(kg|ml|กรัม|กิโลกรัม)\b/i,
    /(\d{1,6}(?:[.,]\d{1,3})?)\s*(มิลลิลิตร|ลิตร)/i,
    // FIX S5869: [gl] with /i flag replaces duplicate [gGlL] character class
    /(\d{1,6}(?:[.,]\d{1,3})?)\s*([gl])\b/i,
  ];

  for (const pattern of weightPatterns) {
    const match = line.match(pattern);
    if (match) {
      const potentialQty = Number.parseFloat(match[1].replace(',', '.'));
      const unit = mapUnitToStandard(match[2]);
      if (isWeightReasonable(potentialQty, unit)) {
        return { quantity: potentialQty, unit };
      }
    }
  }
  return null;
};

const extractWeightFromGeneralPatterns = (lines) => {
  for (const line of lines) {
    const result = matchWeightPattern(line);
    if (result) return result;
  }
  return null;
};

// ─────────────────────────────────────
// Date Parsing Helpers
// ─────────────────────────────────────

/**
 * Parse a date string match into a Date object
 */
const parseDateFromMatch = (match) => {
  const day = Number.parseInt(match[1]);
  const month = Number.parseInt(match[2]);
  let year = Number.parseInt(match[3]);
  if (year < 100) year += 2000;
  if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 2000 && year <= 2100) {
    return new Date(year, month - 1, day);
  }
  return null;
};

// ─────────────────────────────────────
// parseStructuredLabel
// ─────────────────────────────────────

/**
 * Parse structured retail label format
 * FIX: Reduced cognitive complexity by extracting date parsing to parseDateFromMatch
 */
const parseStructuredLabel = (lines, ocrText) => {
  console.log('🏷️ Attempting structured label parsing...');

  const { mfgIndex, bbfIndex } = findMetadataIndices(lines);
  console.log(`🔍 Found MFG at line ${mfgIndex}, BBF at line ${bbfIndex}`);

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

  let quantity = 1;
  let unit = 'piece';

  const weightResult =
    extractWeightFromNetPattern(lines) ||
    extractWeightFromGarbledPatterns(lines) ||
    extractWeightFromGeneralPatterns(lines);

  if (weightResult) {
    quantity = weightResult.quantity;
    unit = weightResult.unit;
  }

  // FIX: Removed unnecessary \/ escape in date regex; extracted date parsing
  const dateRegex = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;

  let manufacturingDate = null;
  if (mfgIndex >= 0) {
    const dateMatch = lines[mfgIndex].match(dateRegex);
    if (dateMatch) {
      manufacturingDate = parseDateFromMatch(dateMatch);
      if (manufacturingDate) console.log(`🔍 MFG: ${manufacturingDate.toLocaleDateString()}`);
    }
  }

  let expiryDate = null;
  if (bbfIndex >= 0) {
    const dateMatch = lines[bbfIndex].match(dateRegex);
    if (dateMatch) {
      expiryDate = parseDateFromMatch(dateMatch);
      if (expiryDate) console.log(`🔍 BBF/EXP: ${expiryDate.toLocaleDateString()}`);
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

// ─────────────────────────────────────
// Helper Functions for parseOCRText
// ─────────────────────────────────────

/**
 * Check if string is mostly readable
 * FIX S5869: Remove duplicate ranges from character class
 * FIX S5852: Character classes with fixed Unicode ranges are safe; no open quantifiers on alternation
 */
const isReadable = (text) => {
  const readable = text.match(/[a-zA-Z0-9\s\-.ก-๙]/g) || [];
  const total = text.length;

  // FIX S5869: Removed redundant Cyrillic sub-ranges (Ъъ, Ёё already within А-Яа-я range)
  const garbledChars = text.match(/[А-Яа-я@#$%^&*(){}[\]|\\<>]/g) || [];
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
  // FIX: Removed unnecessary \/ escape; simplified digit-only pattern
  const notBarcode = !/^\d[\d./-]*$/.test(text);
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
    /วันที่ผลิต|ควรบริโภคก่อน|best before|use by|วันหมดอายุ/i,  // FIX: removed \s* in "best\s*before" — not needed for skip heuristic
    /makro|food service|^temp|^storage|คำแนะนำ|ผลิต\/จำหน่าย|อุณหภูมิ/i,
    /^\d[\d./-]*$/,                                               // FIX: removed unnecessary \/ and duplicate \d
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
 * FIX S5852: Replace open [:\s]* with specific bounded alternatives to prevent ReDoS
 */
const extractQuantityFromNetPatterns = (ocrText) => {
  const patterns = [
    // FIX S5852: [:\s]{0,3} bounds the separator; no unbounded quantifier on alternation
    /ปริมาณสุทธิ[:\s]{0,3}(\d{1,6}(?:[.,]\d{1,3})?)\s{0,3}(kg|g|ml|l|กิโลกรัม|กรัม|มิลลิลิตร|ลิตร)\b/i,
    /ปริมาณสุทธิ[:\s]{0,3}(\d{1,6}(?:[.,]\d{1,3})?)\s{0,3}(piece|pcs|ชิ้น|bottle|ขวด|pack|แพค)\b/i,
    /net\s{0,3}(?:weight|quantity|content)[:\s]{0,3}(\d{1,6}(?:[.,]\d{1,3})?)\s{0,3}(kg|g|ml|l|piece|pcs|bottle|pack)\b/i,
  ];

  for (const pattern of patterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const quantity = Number.parseFloat(match[1].replace(',', '.'));
      const unit = mapUnitToStandard(match[2]);
      return { quantity, unit };
    }
  }

  return null;
};

/**
 * Extract quantity from barcode patterns
 * FIX: Removed unnecessary \/ escape in regex
 */
const extractQuantityFromBarcodePatterns = (ocrText) => {
  const pattern = /(\d{2,})\/\d+\s+(\d+\.\d+)\s+(\w+)/;
  const match = ocrText.match(pattern);

  if (match) {
    const weightValue = Number.parseFloat(match[2]);
    const unitText = match[3].toLowerCase();

    if (weightValue > 0) {
      if (/kg|kl|11/.test(unitText)) return { quantity: weightValue, unit: 'kg' };
      if (/gm?/.test(unitText)) return { quantity: weightValue, unit: 'g' };   // FIX: simplified /g|gm/ → /gm?/
      if (/ml/.test(unitText)) return { quantity: weightValue, unit: 'ml' };
      if (/20|l/.test(unitText)) return { quantity: weightValue, unit: 'kg' };
    }
  }

  return null;
};

/**
 * Classify a date entry by its surrounding context
 */
const classifyDateByContext = (context) => {
  const contextLower = context.toLowerCase();
  if (/mfd|manufactured|production|วันที่ผลิต/.test(contextLower)) return 'mfg';
  if (/exp|expiry|best before|use by|วันหมดอายุ|ควรบริโภคก่อน/.test(contextLower)) return 'exp';
  return null;
};

/**
 * Extract and classify all dates
 * FIX: Reduced cognitive complexity by extracting classifyDateByContext;
 *      removed unnecessary \/ escape in date regex
 */
const extractAndClassifyDates = (ocrText) => {
  const allDates = [];
  // FIX: Removed unnecessary \/ escape
  const dateRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  let dateMatch;

  while ((dateMatch = dateRegex.exec(ocrText)) !== null) {
    try {
      const date = parseDateFromMatch(dateMatch);
      if (date) {
        const context = ocrText.substring(Math.max(0, dateMatch.index - 20), dateMatch.index);
        allDates.push({ date, context });
      }
    } catch (e) {
      console.error('Date parsing error:', e);
    }
  }

  console.log(`🔍 Found ${allDates.length} dates in text`);

  let expiryDate = null;
  let manufacturingDate = null;

  for (const { date, context } of allDates) {
    const type = classifyDateByContext(context);
    if (type === 'mfg' && !manufacturingDate) {
      manufacturingDate = date;
      console.log(`🔍 Found MFD (from context): ${date.toLocaleDateString()}`);
    } else if (type === 'exp' && !expiryDate) {
      expiryDate = date;
      console.log(`🔍 Found EXP (from context): ${date.toLocaleDateString()}`);
    }
  }

  if (allDates.length === 2 && !manufacturingDate && !expiryDate) {
    allDates.sort((a, b) => a.date - b.date);
    manufacturingDate = allDates[0].date;
    expiryDate = allDates[1].date;
    console.log(`🔍 Found MFD (heuristic - earlier date): ${manufacturingDate.toLocaleDateString()}`);
    console.log(`🔍 Found EXP (heuristic - later date): ${expiryDate.toLocaleDateString()}`);
  } else if (allDates.length === 1 && !manufacturingDate && !expiryDate) {
    expiryDate = allDates[0].date;
    console.log(`🔍 Found date (assumed EXP): ${expiryDate.toLocaleDateString()}`);
  }

  return { expiryDate, manufacturingDate };
};

/**
 * Parse OCR result to extract product information
 * FIX: Fixed `const quantityResult` being reassigned → use `let`
 */
const parseOCRText = (ocrText, language = 'th') => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('📄 OCR Text Lines:', lines);

  const hasMFG = /\bmfg[:\s]/i.test(ocrText) || /วันที่ผลิต/i.test(ocrText);
  const hasBBF = /\bbbf[:\s]/i.test(ocrText) || /best before/i.test(ocrText);  // FIX: removed \s* — "best before" is sufficient

  if (hasMFG || hasBBF) {
    console.log('🏷️ Detected structured label format (MFG/BBF present)');
    const structured = parseStructuredLabel(lines, ocrText);
    if (structured.name !== 'Product') {
      console.log('✅ Structured parsing successful');
      return structured;
    }
    console.log('⚠️ Structured parsing incomplete, falling back to general parsing');
  }

  const productName = extractProductNameFromText(lines);

  let quantity = 1;
  let unit = 'piece';

  // FIX: Was `const quantityResult` then reassigned — changed to `let`
  let quantityResult = extractQuantityFromNetPatterns(ocrText);
  if (!quantityResult) {
    quantityResult = extractQuantityFromBarcodePatterns(ocrText);
  }

  if (quantityResult) {
    quantity = quantityResult.quantity;
    unit = quantityResult.unit;
  }

  const { expiryDate, manufacturingDate } = extractAndClassifyDates(ocrText);

  return {
    name: productName || 'Product',
    quantity,
    unit,
    expiryDate,
    manufacturingDate,
  };
};

// ─────────────────────────────────────
// OCR Quality Score Helpers
// ─────────────────────────────────────

/** FIX S3776: Extracted from calculateOCRQuality to reduce complexity */
const scoreProductName = (name, issues) => {
  if (name === 'Product') {
    issues.push('Product name not detected');
    return -30;
  }
  let delta = 0;
  // FIX S5869: Removed redundant Ёё sub-range (covered by А-Яа-я)
  const garbledChars = name.match(/[А-Яа-я@#$%^&*(){}[\]|\\<>]/g) || [];
  if (garbledChars.length > 0) {
    issues.push('Product name contains unreadable characters');
    delta -= 20;
  }
  if (name.length < 3) {
    issues.push('Product name too short');
    delta -= 15;
  }
  return delta;
};

/** FIX S3776: Extracted from calculateOCRQuality to reduce complexity */
const scoreDates = (parsedData, isStructured, issues) => {
  if (!parsedData.expiryDate && !parsedData.manufacturingDate) {
    issues.push('No dates detected');
    return isStructured ? -15 : -20;
  }
  if (parsedData.manufacturingDate && parsedData.expiryDate) {
    console.log('✅ Both MFG and BBF dates found');
    return 5;
  }
  return 0;
};

/** FIX S3776: Extracted from calculateOCRQuality to reduce complexity */
const scoreTextReadability = (rawText, issues) => {
  const totalChars = rawText.length;
  const readableChars = (rawText.match(/[a-zA-Z0-9\s\-.ก-๙]/g) || []).length;
  const ratio = readableChars / totalChars;
  if (ratio < 0.6) {
    issues.push('Low text quality - try better lighting');
    return -20;
  }
  return ratio > 0.85 ? 5 : 0;
};

/**
 * Calculate OCR quality score
 * FIX S3776: Reduced complexity from 20 to ~8 by extracting scoring helpers
 */
const calculateOCRQuality = (rawText, parsedData) => {
  let score = 100;
  const issues = [];
  const isStructured = !!parsedData.structured;

  if (isStructured) console.log('✅ Structured label detected - applying bonus');

  score += scoreProductName(parsedData.name, issues);
  score += scoreDates(parsedData, isStructured, issues);

  if (parsedData.quantity === 1 && parsedData.unit === 'piece') {
    issues.push('Weight not detected');
    score -= isStructured ? 5 : 10;
  }

  score += scoreTextReadability(rawText, issues);

  let confidence = 'high';
  if (score < 70) confidence = 'medium';
  if (score < 50) confidence = 'low';

  return {
    score: Math.max(0, Math.min(100, score)),
    confidence,
    issues,
  };
};

// ─────────────────────────────────────
// Azure Response Text Extraction Helpers
// ─────────────────────────────────────

/** FIX S3776: Extracted from extractTextFromAzureResponse */
const extractFromParagraphs = (paragraphs) => {
  console.log('🔍 Extracting from paragraphs...');
  return paragraphs.map(p => p.content || '').join('\n');
};

/** FIX S3776: Extracted from extractTextFromAzureResponse */
const extractFromReadResults = (readResults) => {
  console.log('🔍 Extracting from readResults...');
  return readResults.flatMap(page => page.lines.map(l => l.text)).join('\n');
};

/** FIX S3776: Extracted from extractTextFromAzureResponse */
const extractFromPages = (pages) => {
  console.log('🔍 Extracting from pages...');
  return pages
    .filter(page => page.lines)
    .flatMap(page => page.lines.map(l => l.content))
    .join('\n');
};

/**
 * Extract text from Azure Document Intelligence response
 * FIX S3776: Reduced complexity from 23 to ~5 by extracting per-source helpers
 */
const extractTextFromAzureResponse = (ocrResult) => {
  if (!ocrResult.analyzeResult) return '';

  const { analyzeResult } = ocrResult;

  if (analyzeResult.paragraphs?.length > 0) return extractFromParagraphs(analyzeResult.paragraphs);
  if (analyzeResult.readResults?.length > 0) return extractFromReadResults(analyzeResult.readResults);
  if (analyzeResult.pages?.length > 0) return extractFromPages(analyzeResult.pages);

  return '';
};

// ─────────────────────────────────────
// parseImage Helpers
// ─────────────────────────────────────

/**
 * Resolve image buffer from request
 * FIX S3776: Extracted from parseImage to reduce its complexity
 */
const resolveImageBuffer = (req) => {
  const { base64Image } = req.body;
  if (base64Image) {
    console.log('📸 Received base64 image from client');
    const buffer = Buffer.from(base64Image, 'base64');
    console.log(`📦 Decoded base64 to buffer: ${buffer.length} bytes`);
    return buffer;
  }
  if (req.file) {
    console.log('📸 Received image file from client');
    return req.file.buffer;
  }
  return null;
};

/**
 * Poll Azure operation until succeeded/failed/timeout
 * FIX S3776: Extracted from parseImage to reduce its complexity
 */
const pollOcrOperation = async (operationLocation, apiKey, maxAttempts = 60) => {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const statusResponse = await axios.get(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    const { status } = statusResponse.data;
    if (status === 'succeeded') return { result: statusResponse.data, failed: false };
    if (status === 'failed') return { result: null, failed: true };
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return { result: null, failed: false }; // timeout
};

/**
 * Process image with Azure Document Intelligence OCR
 * FIX S3776: Reduced complexity from 21 to ~10 by extracting resolveImageBuffer and pollOcrOperation
 */
exports.parseImage = async (req, res) => {
  const tracer = trace.getTracer('ocr-controller');
  const span = tracer.startSpan('parseImage', {
    attributes: {
      'ocr.language': req.body.language || 'en',
      'ocr.has_file': !!req.file,
      'ocr.has_base64': !!req.body.base64Image,
    },
  });

  try {
    logger.info('OCR parse image request received', {
      language: req.body.language || 'en',
      has_file: !!req.file,
      has_base64: !!req.body.base64Image,
    });

    if (!isConfigured()) {
      span.setStatus({ code: 2, message: 'Azure not configured' });
      logger.error('Azure Document Intelligence not configured');
      return res.status(500).json({ success: false, error: 'Azure Document Intelligence is not configured' });
    }

    // FIX S3776: Buffer resolution delegated to resolveImageBuffer
    let imageBuffer;
    try {
      imageBuffer = resolveImageBuffer(req);
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: 2, message: 'Invalid base64' });
      logger.error('Base64 decode error', { error: err.message });
      return res.status(400).json({ success: false, error: 'Invalid base64 image data' });
    }

    if (!imageBuffer) {
      span.setStatus({ code: 2, message: 'No image provided' });
      logger.warn('No image provided in OCR request');
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    span.setAttribute('ocr.image_size_bytes', imageBuffer.length);
    logger.debug('Image buffer resolved', { size_bytes: imageBuffer.length });

    let endpoint = AZURE_DI_ENDPOINT.endsWith('/')
      ? AZURE_DI_ENDPOINT.slice(0, -1)
      : AZURE_DI_ENDPOINT;

    const ocrUrl = `${endpoint}/formrecognizer/documentmodels/prebuilt-read:analyze?api-version=2023-07-31`;
    console.log('📸 Sending image to Azure Document Intelligence OCR...');
    console.log(`🔗 OCR URL: ${ocrUrl}`);
    console.log(`🔑 Using API Key: ${AZURE_DI_KEY.substring(0, 10)}...`);
    console.log(`📦 Image Buffer Size: ${imageBuffer.length} bytes`);

    // Create span for Azure API call
    const azureSpan = tracer.startSpan('azure_document_intelligence_call', {
      attributes: {
        'azure.endpoint': endpoint,
        'azure.api_version': '2023-07-31',
        'azure.model': 'prebuilt-read',
      },
    });

    let ocrResult;
    try {
      const response = await axios.post(ocrUrl, imageBuffer, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_DI_KEY,
          'Content-Type': 'application/octet-stream',
          'Content-Length': imageBuffer.length,
        },
        timeout: 60000,
        maxRedirects: 0,
      });

      const operationLocation = response.headers['operation-location'];
      if (!operationLocation) {
        azureSpan.setStatus({ code: 2, message: 'No operation location' });
        azureSpan.end();
        return res.status(500).json({ success: false, error: 'Failed to process image with Azure Document Intelligence' });
      }

      // FIX S3776: Polling delegated to pollOcrOperation
      const { result, failed } = await pollOcrOperation(operationLocation, AZURE_DI_KEY);
      ocrResult = result;

      if (failed) {
        azureSpan.setStatus({ code: 2, message: 'OCR processing failed' });
        azureSpan.end();
        return res.status(500).json({ success: false, error: 'OCR processing failed' });
      }
      if (!ocrResult) {
        azureSpan.setStatus({ code: 2, message: 'OCR processing timeout' });
        azureSpan.end();
        return res.status(500).json({ success: false, error: 'OCR processing timeout' });
      }

      azureSpan.setStatus({ code: 1 }); // OK
      azureSpan.end();
    } catch (azureError) {
      azureSpan.recordException(azureError);
      azureSpan.setStatus({ code: 2, message: azureError.message });
      azureSpan.end();
      throw azureError;
    }

    const extractedText = extractTextFromAzureResponse(ocrResult);
    console.log(`📊 Full OCR Response Structure:`, JSON.stringify(ocrResult, null, 2).substring(0, 500));
    console.log('✅ OCR extraction complete');
    console.log(`📝 Full OCR text:\n${extractedText}`);
    console.log(`📝 Text length: ${extractedText.length} characters`);

    const { language = 'en' } = req.body;
    const parsedData = parseOCRText(extractedText, language);
    const qualityScore = calculateOCRQuality(extractedText, parsedData);
    console.log(`📊 OCR Quality Score: ${qualityScore.score}/100`);

    span.setAttribute('ocr.text_length', extractedText.length);
    span.setAttribute('ocr.product_name', parsedData.name);
    span.setAttribute('ocr.quality_score', qualityScore.score);
    span.setAttribute('ocr.confidence', qualityScore.confidence);
    span.setStatus({ code: 1 }); // OK

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
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process image',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        status: error.response?.status,
        data: error.response?.data,
      } : undefined,
    });
  } finally {
    span.end();
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