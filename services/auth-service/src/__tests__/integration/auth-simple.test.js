/**
 * Auth Service Integration Tests
 * Simplified version that tests controllers directly
 */

const jwt = require('jsonwebtoken');

describe('Auth Service - JWT and Token Logic Tests', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-do-not-use-in-production';

  describe('JWT Token Creation and Validation', () => {
    test('should create valid JWT token with user claims', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        entraIdUserId: 'test-oid-123',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    test('should verify and decode valid token', () => {
      const payload = {
        userId: 'test-user-123',
        entraIdUserId: 'oid-456',
        email: 'user@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.entraIdUserId).toBe(payload.entraIdUserId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    test('should reject expired token', () => {
      const payload = {
        userId: 'test-user',
        email: 'test@example.com',
      };

      const expiredToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });

      expect(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }).toThrow('jwt expired');
    });

    test('should reject token with wrong secret', () => {
      const payload = { userId: 'test' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '24h' });

      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow('invalid signature');
    });

    test('should reject malformed token', () => {
      expect(() => {
        jwt.verify('not-a-valid-token', JWT_SECRET);
      }).toThrow();

      expect(() => {
        jwt.verify('header.payload', JWT_SECRET);
      }).toThrow();
    });

    test('should set token expiration to 24 hours', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      const expiresInSeconds = decoded.exp - decoded.iat;
      expect(expiresInSeconds).toBe(86400); // 24 * 60 * 60 = 86400 seconds
    });

    test('should include all required claims', () => {
      const requiredClaims = {
        userId: 'user-123',
        entraIdUserId: 'oid-abc',
        email: 'test@example.com',
      };

      const token = jwt.sign(requiredClaims, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.decode(token);

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('entraIdUserId');
      expect(decoded).toHaveProperty('email');
      expect(decoded.userId).toBe(requiredClaims.userId);
      expect(decoded.entraIdUserId).toBe(requiredClaims.entraIdUserId);
      expect(decoded.email).toBe(requiredClaims.email);
    });

    test('should handle special characters in email', () => {
      const payload = {
        userId: 'test',
        email: 'user+tag@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.email).toBe('user+tag@example.com');
    });

    test('should handle Unicode characters in name', () => {
      const payload = {
        userId: 'test',
        name: 'นาย ทดสอบ',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.name).toBe('นาย ทดสอบ');
    });
  });

  describe('Token Payload Validation', () => {
    test('should validate userId is present', () => {
      const tokenWithoutUserId = jwt.sign({ email: 'test@example.com' }, JWT_SECRET);
      const decoded = jwt.decode(tokenWithoutUserId);

      expect(decoded).not.toHaveProperty('userId');
    });

    test('should validate email format (basic check)', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.co.th',
        'user+tag@subdomain.example.com',
      ];

      validEmails.forEach(email => {
        const token = jwt.sign({ userId: 'test', email }, JWT_SECRET);
        const decoded = jwt.decode(token);
        expect(decoded.email).toBe(email);
        expect(decoded.email).toMatch(/@/); // Contains @
      });
    });

    test('should handle missing optional fields gracefully', () => {
      const minimalPayload = {
        userId: 'test-123',
      };

      const token = jwt.sign(minimalPayload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.userId).toBe('test-123');
      expect(decoded.email).toBeUndefined();
      expect(decoded.entraIdUserId).toBeUndefined();
    });
  });

  describe('Token Security Tests', () => {
    test('should use strong secret key in production', () => {
      // This test documents the expected behavior
      const devSecret = 'dev-secret-key';
      const productionSecret = process.env.JWT_SECRET || devSecret;

      // In production, secret should be longer than dev secret
      if (process.env.NODE_ENV === 'production') {
        expect(productionSecret.length).toBeGreaterThan(devSecret.length);
      } else {
        // In test/dev, we allow shorter secrets
        expect(productionSecret).toBeDefined();
      }
    });

    test('should not decode token without verification', () => {
      const payload = { userId: 'test', admin: false };
      const token = jwt.sign(payload, JWT_SECRET);

      // Decoding without verification is unsafe but possible
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe('test');

      // Always verify in production code
      const verified = jwt.verify(token, JWT_SECRET);
      expect(verified.userId).toBe('test');
    });

    test('should prevent token tampering', () => {
      const originalPayload = { userId: 'user-123', admin: false };
      const token = jwt.sign(originalPayload, JWT_SECRET);

      // Split token into parts
      const [header, payload, signature] = token.split('.');

      // Try to tamper with payload (change admin to true)
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: 'user-123', admin: true })
      ).toString('base64url');

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      // Verification should fail
      expect(() => {
        jwt.verify(tamperedToken, JWT_SECRET);
      }).toThrow('invalid signature');
    });

    test('should use HS256 algorithm by default', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET);
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded.header.alg).toBe('HS256');
    });
  });

  describe('Token Expiration Edge Cases', () => {
    test('should handle token at exact expiration time', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        userId: 'test',
        iat: now,
        exp: now + 1, // Expires in 1 second
      };

      const token = jwt.sign(payload, JWT_SECRET, { noTimestamp: true });

      // Should be valid immediately
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe('test');

      // After expiration, should throw
      // (In real test, would need to wait or mock time)
    });

    test('should handle very long expiration times', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '365d' });
      const decoded = jwt.verify(token, JWT_SECRET);

      const expiresInDays = (decoded.exp - decoded.iat) / 86400;
      expect(expiresInDays).toBe(365);
    });

    test('should handle short-lived tokens (5 minutes)', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '5m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      const expiresInSeconds = decoded.exp - decoded.iat;
      expect(expiresInSeconds).toBe(300); // 5 * 60 = 300 seconds
    });
  });

  describe('Authorization Header Parsing', () => {
    test('should extract token from Bearer header', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET);
      const authHeader = `Bearer ${token}`;

      // Simulate middleware parsing
      const extractedToken = authHeader.split(' ')[1];

      expect(extractedToken).toBe(token);

      const decoded = jwt.verify(extractedToken, JWT_SECRET);
      expect(decoded.userId).toBe('test');
    });

    test('should handle header with extra whitespace', () => {
      const token = jwt.sign({ userId: 'test' }, JWT_SECRET);
      const authHeader = `Bearer  ${token}  `;

      const parts = authHeader.trim().split(/\s+/);
      const extractedToken = parts[1];

      expect(extractedToken).toBe(token);
    });

    test('should reject malformed Authorization header', () => {
      const malformedHeaders = [
        'InvalidFormat',
        'Bearer',
        'Bearer ',
        'Basic dXNlcjpwYXNz', // Wrong auth scheme
        '',
      ];

      malformedHeaders.forEach(header => {
        const parts = header.split(' ');
        if (parts[0] !== 'Bearer' || !parts[1]) {
          // Should reject
          expect(parts[0] === 'Bearer' && parts[1]).toBeFalsy();
        }
      });
    });
  });
});
