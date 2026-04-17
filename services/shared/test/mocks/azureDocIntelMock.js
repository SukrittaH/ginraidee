const nock = require('nock');

/**
 * Mock Azure Document Intelligence API responses
 * Uses nock to intercept HTTP requests to Azure Document Intelligence endpoints
 */

// Default Azure Document Intelligence endpoint format
const AZURE_DI_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'https://test-doc-intel.cognitiveservices.azure.com';

/**
 * Mock successful OCR analysis with given text
 * @param {string} extractedText - Text to return from OCR
 * @param {string} operationId - Operation ID for polling (default: random)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOCRAnalysis(extractedText = 'Test Product\n1.5 kg\nMFG: 01.01.2024\nBBF: 01.01.2025', operationId = 'test-operation-123') {
  const baseUrl = AZURE_DI_ENDPOINT.replace(/\/$/, '');
  const operationLocation = `${baseUrl}/formrecognizer/documentModels/prebuilt-read/analyzeResults/${operationId}?api-version=2023-07-31`;

  // Mock the initial POST request
  nock(baseUrl)
    .post(/\/formrecognizer\/documentmodels\/prebuilt-read:analyze/)
    .query(true)
    .reply(202, '', {
      'operation-location': operationLocation,
    });

  // Mock the polling GET request (return succeeded immediately)
  nock(baseUrl)
    .get(/\/formrecognizer\/documentModels\/prebuilt-read\/analyzeResults\/.*/)
    .query(true)
    .reply(200, {
      status: 'succeeded',
      analyzeResult: {
        content: extractedText,
        pages: [
          {
            pageNumber: 1,
            lines: extractedText.split('\n').map((text, index) => ({
              content: text,
              boundingBox: [0, index * 10, 100, index * 10, 100, (index + 1) * 10, 0, (index + 1) * 10],
            })),
          },
        ],
      },
    });

  return nock;
}

/**
 * Mock OCR analysis with Thai product receipt
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockThaiProductReceipt() {
  const thaiText = `นมสดเดนมาร์ค Fresh Milk
ปริมาณสุทธิ: 1.5 kg
MFG: 15.03.2024
BBF: 15.09.2024`;
  return mockOCRAnalysis(thaiText);
}

/**
 * Mock OCR analysis with English product receipt
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockEnglishProductReceipt() {
  const englishText = `Organic Chicken Breast
Net Weight: 500 g
MFG: 10.04.2024
EXP: 17.04.2024`;
  return mockOCRAnalysis(englishText);
}

/**
 * Mock OCR analysis with bilingual receipt
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockBilingualReceipt() {
  const bilingualText = `ข้าวหอมมะลิ Jasmine Rice
น้ำหนักสุทธิ 5.0 kg
วันที่ผลิต: 01.01.2024
ควรบริโภคก่อน: 01.01.2025`;
  return mockOCRAnalysis(bilingualText);
}

/**
 * Mock OCR with processing failure
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOCRFailure() {
  const baseUrl = AZURE_DI_ENDPOINT.replace(/\/$/, '');
  const operationLocation = `${baseUrl}/formrecognizer/documentModels/prebuilt-read/analyzeResults/failed-operation?api-version=2023-07-31`;

  nock(baseUrl)
    .post(/\/formrecognizer\/documentmodels\/prebuilt-read:analyze/)
    .query(true)
    .reply(202, '', {
      'operation-location': operationLocation,
    });

  nock(baseUrl)
    .get(/\/formrecognizer\/documentModels\/prebuilt-read\/analyzeResults\/.*/)
    .query(true)
    .reply(200, {
      status: 'failed',
      error: {
        code: 'InvalidImage',
        message: 'The provided image is invalid or corrupted',
      },
    });

  return nock;
}

/**
 * Mock OCR API error (e.g., invalid API key, service down)
 * @param {number} statusCode - HTTP status code (default: 401)
 * @param {string} errorMessage - Error message
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOCRAPIError(statusCode = 401, errorMessage = 'Invalid API key') {
  const baseUrl = AZURE_DI_ENDPOINT.replace(/\/$/, '');

  return nock(baseUrl)
    .post(/\/formrecognizer\/documentmodels\/prebuilt-read:analyze/)
    .query(true)
    .reply(statusCode, {
      error: {
        code: statusCode === 401 ? 'Unauthorized' : 'ServiceError',
        message: errorMessage,
      },
    });
}

/**
 * Mock OCR with no operation-location header (malformed response)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOCRNoOperationLocation() {
  const baseUrl = AZURE_DI_ENDPOINT.replace(/\/$/, '');

  return nock(baseUrl)
    .post(/\/formrecognizer\/documentmodels\/prebuilt-read:analyze/)
    .query(true)
    .reply(202, '');
}

/**
 * Mock OCR with blurry/low quality image (poor text extraction)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockLowQualityOCR() {
  const poorText = `Pr0duct
1..5 nn.
MF6: 01/01/2024
8BF: ??/??/????`;
  return mockOCRAnalysis(poorText);
}

/**
 * Clear all nock mocks
 */
function clearMocks() {
  nock.cleanAll();
}

/**
 * Check if all mocks have been called
 * @returns {boolean} True if all mocks satisfied
 */
function verifyMocks() {
  return nock.isDone();
}

module.exports = {
  mockOCRAnalysis,
  mockThaiProductReceipt,
  mockEnglishProductReceipt,
  mockBilingualReceipt,
  mockOCRFailure,
  mockOCRAPIError,
  mockOCRNoOperationLocation,
  mockLowQualityOCR,
  clearMocks,
  verifyMocks,
};
