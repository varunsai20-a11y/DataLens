import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import { authService } from '../services/authService';
import { pool } from '../services/db';

describe('Subphase 4.1 Authentication & User Management Tests', () => {
  describe('AuthService Unit Tests', () => {
    test('password hashing with bcryptjs should produce valid hash', async () => {
      const password = 'SecretPassword123!';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true);


      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);

      const isMismatch = await bcrypt.compare('WrongPassword', hash);
      expect(isMismatch).toBe(false);
    });

    test('generateToken and verifyToken should sign and verify JWT payload', () => {
      const mockUser = {
        id: '12345678-1234-1234-1234-123456789012',
        email: 'user@example.com',
        name: 'Test User',
        role: 'USER' as const,
        is_system: false,
        created_at: new Date().toISOString(),
      };

      const token = authService.generateToken(mockUser);
      expect(typeof token).toBe('string');

      const payload = authService.verifyToken(token);
      expect(payload.id).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.role).toBe('USER');
    });

    test('verifyToken should reject expired or malformed token', () => {
      expect(() => authService.verifyToken('invalid.token.string')).toThrow();

      // Sign expired token manually
      const expiredToken = jwt.sign(
        { id: '123', email: 'test@example.com' },
        'test-secret-key-for-jest',
        { expiresIn: '-1s' }
      );

      expect(() => authService.verifyToken(expiredToken)).toThrow();
    });
  });

  describe('Auth Controller & API Route Tests (Mocked DB)', () => {
    test('POST /api/v1/auth/register should successfully register a new user', async () => {
      const mockUserRecord = {
        id: 'usr-1',
        email: 'newuser@example.com',
        password_hash: '$2a$12$hash',
        name: 'New User',
        role: 'USER',
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (jest.spyOn(pool, 'query') as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // existing check returns empty
        .mockResolvedValueOnce({ rows: [mockUserRecord] }); // insert user

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123', name: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.user.email).toBe('newuser@example.com');
      expect(res.body.token).toBeDefined();
    });

    test('POST /api/v1/auth/register should reject duplicate email registration', async () => {
      (jest.spyOn(pool, 'query') as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'existing@example.com', password: 'password123', name: 'Existing User' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_EXISTS');
    });

    test('POST /api/v1/auth/register should reject registration with reserved demo email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'demo@datalens.internal', password: 'password123', name: 'Fake Demo' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_EXISTS');
    });

    test('POST /api/v1/auth/login should authenticate valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 12);
      const mockUserRecord = {
        id: 'usr-2',
        email: 'login@example.com',
        password_hash: passwordHash,
        name: 'Login User',
        role: 'USER',
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (jest.spyOn(pool, 'query') as jest.Mock).mockResolvedValueOnce({ rows: [mockUserRecord] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.token).toBeDefined();
    });

    test('POST /api/v1/auth/login should reject invalid password', async () => {
      const passwordHash = await bcrypt.hash('secret123', 12);
      const mockUserRecord = {
        id: 'usr-2',
        email: 'login@example.com',
        password_hash: passwordHash,
        name: 'Login User',
        role: 'USER',
        is_system: false,
        created_at: new Date().toISOString(),
      };

      (jest.spyOn(pool, 'query') as jest.Mock).mockResolvedValueOnce({ rows: [mockUserRecord] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    test('POST /api/v1/auth/login MUST REJECT login attempts to System Demo Account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'demo@datalens.internal', password: 'anypassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toContain('System demo account cannot be logged into');
    });

    test('GET /api/v1/auth/me should return user profile when valid Bearer token provided', async () => {
      const mockUser = {
        id: 'usr-3',
        email: 'me@example.com',
        name: 'Me User',
        role: 'USER' as const,
        is_system: false,
        created_at: new Date().toISOString(),
      };

      const token = authService.generateToken(mockUser);

      (jest.spyOn(pool, 'query') as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: 'hash' }],
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.user.email).toBe('me@example.com');
    });

    test('GET /api/v1/auth/me should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
      expect(res.body.message).toContain('missing');
    });

    test('GET /api/v1/auth/me should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidHeaderFormat');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
      expect(res.body.message).toContain('Format must be "Bearer <token>"');
    });
  });
});
