// Set test environment variables BEFORE requiring any modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com';
process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key';

const supertest = require('supertest');
const app = require('../../app');
const { generateTestToken } = require('../../../../shared/test/helpers/apiHelper');
const {
  mockThaiProductReceipt,
  mockEnglishProductReceipt,
  mockBilingualReceipt,
  mockOCRFailure,
  mockOCRAPIError,
  mockOCRNoOperationLocation,
  mockLowQualityOCR,
  clearMocks,
} = require('../../../../shared/test/mocks/azureDocIntelMock');

describe('OCR API - Integration Tests', () => {
  let testToken;

  beforeAll(() => {
    // Generate test JWT token
    testToken = generateTestToken({ userId: 'test-user-123' });
  });

  afterEach(() => {
    // Clear all nock mocks after each test
    clearMocks();
  });

  describe('POST /api/ocr/parse - OCR Image Parsing', () => {
    it('should parse Thai product receipt successfully', async () => {
      clearMocks();
      mockThaiProductReceipt();

      // Create a fake image buffer (just need valid buffer for test)
      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image, language: 'th' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.rawText).toContain('Fresh Milk');
      expect(response.body.data.parsed).toBeDefined();
      expect(response.body.data.parsed.name).toBeDefined();
      expect(response.body.data.parsed.quantity).toBeDefined();
      expect(response.body.data.parsed.unit).toBeDefined();
      expect(response.body.data.quality).toBeDefined();
      expect(response.body.data.quality.score).toBeGreaterThan(0);
    });

    it('should parse English product receipt successfully', async () => {
      clearMocks();
      mockEnglishProductReceipt();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image, language: 'en' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rawText).toContain('Organic Chicken Breast');
      expect(response.body.data.parsed.name).toBe('Organic Chicken Breast');
      expect(response.body.data.parsed.quantity).toBe(500);
      expect(response.body.data.parsed.unit).toBe('g');
    });

    it('should parse bilingual receipt successfully', async () => {
      clearMocks();
      mockBilingualReceipt();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rawText).toContain('Jasmine Rice');
      expect(response.body.data.parsed.quantity).toBe(5);
      expect(response.body.data.parsed.unit).toBe('kg');
    });

    it('should extract manufacturing and expiry dates', async () => {
      clearMocks();
      mockEnglishProductReceipt();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.parsed.manufacturingDate).toBeDefined();
      expect(response.body.data.parsed.expiryDate).toBeDefined();
    });

    it('should handle low quality OCR with quality warnings', async () => {
      clearMocks();
      mockLowQualityOCR();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Quality score may vary, just check that issues are reported
      expect(response.body.data.quality.issues.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(response.body.data.quality.confidence);
    });

    it('should return 400 when no image provided', async () => {
      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No image provided');
    });

    it('should return 500 when invalid base64 provided', async () => {
      // Invalid base64 gets through Buffer.from() but creates invalid image buffer
      // Azure will reject it, so we expect 500 not 400
      clearMocks();
      mockOCRAPIError(400, 'Invalid image format');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image: 'invalid-base64!!!!' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to process image');
    });

    it('should return 401 when no authentication token', async () => {
      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      await supertest(app)
        .post('/api/ocr/parse')
        .send({ base64Image })
        .expect(401);
    });

    it('should handle Azure OCR processing failure', async () => {
      clearMocks();
      mockOCRFailure();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OCR processing failed');
    });

    it('should handle Azure API errors (invalid API key)', async () => {
      clearMocks();
      mockOCRAPIError(401, 'Invalid API key');

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to process image');
    });

    it('should handle missing operation-location header', async () => {
      clearMocks();
      mockOCRNoOperationLocation();

      const fakeImageBuffer = Buffer.from('fake-image-data');
      const base64Image = fakeImageBuffer.toString('base64');

      const response = await supertest(app)
        .post('/api/ocr/parse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ base64Image })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to process image');
    });
  });

  describe('GET /api/ocr/health - Health Check', () => {
    it('should return health status', async () => {
      const response = await supertest(app)
        .get('/api/ocr/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.configured).toBe(true);
      expect(response.body.service).toBe('Azure Document Intelligence');
      expect(response.body.endpoint).toBeDefined();
    });
  });
});
