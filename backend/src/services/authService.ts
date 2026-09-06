import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db';
import { config } from '../config';
import logger from '../utils/logger';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'USER' | 'ADMIN';
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  is_system: boolean;
  created_at: string;
}

export class AuthService {
  private getJwtSecret(): string {
    const secret = config.jwt.secret;
    if (!secret || secret.trim().length === 0) {
      throw new Error('FATAL: JWT_SECRET environment variable is mandatory for authentication.');
    }
    return secret.trim();
  }

  public sanitizeUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_system: user.is_system,
      created_at: user.created_at,
    };
  }

  public generateToken(user: PublicUser): string {
    const secret = this.getJwtSecret();
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '24h' }
    );
  }

  public verifyToken(token: string): { id: string; email: string; role: string } {
    const secret = this.getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;
    if (!decoded || !decoded.id || !decoded.email) {
      throw new Error('INVALID_TOKEN: Malformed JWT payload.');
    }
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER',
    };
  }

  public async register(
    email: string,
    password: string,
    name: string,
    role: 'USER' | 'ADMIN' = 'USER'
  ): Promise<{ user: PublicUser; token: string }> {
    const sanitizedEmail = email?.trim().toLowerCase();
    const sanitizedName = name?.trim();

    if (!sanitizedEmail || !/\S+@\S+\.\S+/.test(sanitizedEmail)) {
      throw new Error('INVALID_INPUT: A valid email address is required.');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('INVALID_INPUT: Password must be at least 6 characters long.');
    }

    if (!sanitizedName) {
      throw new Error('INVALID_INPUT: Name is required.');
    }

    if (sanitizedEmail === 'demo@datalens.internal') {
      throw new Error('EMAIL_EXISTS: Cannot register using system reserved email address.');
    }

    // Check if email already exists
    const existingRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [sanitizedEmail]);
    if (existingRes.rows.length > 0) {
      throw new Error('EMAIL_EXISTS: An account with this email address already exists.');
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const insertRes = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_system)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, email, password_hash, name, role, is_system, created_at, updated_at`,
      [sanitizedEmail, passwordHash, sanitizedName, role]
    );

    const userRecord: UserRecord = insertRes.rows[0];
    const publicUser = this.sanitizeUser(userRecord);
    const token = this.generateToken(publicUser);

    logger.info(`User registered successfully: ${publicUser.email} (${publicUser.id})`);
    return { user: publicUser, token };
  }

  public async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const sanitizedEmail = email?.trim().toLowerCase();

    if (!sanitizedEmail || !password) {
      throw new Error('INVALID_CREDENTIALS: Email and password are required.');
    }

    // Explicit security check: Block direct login to system demo account
    if (sanitizedEmail === 'demo@datalens.internal') {
      logger.warn(`Attempted login to system demo account blocked: ${sanitizedEmail}`);
      throw new Error('INVALID_CREDENTIALS: System demo account cannot be logged into directly.');
    }

    const userRes = await pool.query(
      `SELECT id, email, password_hash, name, role, is_system, created_at, updated_at FROM users WHERE email = $1`,
      [sanitizedEmail]
    );

    if (userRes.rows.length === 0) {
      throw new Error('INVALID_CREDENTIALS: Invalid email or password.');
    }

    const userRecord: UserRecord = userRes.rows[0];

    // Double-check is_system flag
    if (userRecord.is_system) {
      logger.warn(`Attempted login to system user blocked: ${sanitizedEmail}`);
      throw new Error('INVALID_CREDENTIALS: System demo account cannot be logged into directly.');
    }

    // Verify bcrypt password hash
    const isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS: Invalid email or password.');
    }

    const publicUser = this.sanitizeUser(userRecord);
    const token = this.generateToken(publicUser);

    logger.info(`User logged in successfully: ${publicUser.email} (${publicUser.id})`);
    return { user: publicUser, token };
  }

  public async getUserById(id: string): Promise<PublicUser | null> {
    const res = await pool.query(
      `SELECT id, email, password_hash, name, role, is_system, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return this.sanitizeUser(res.rows[0]);
  }
}

export const authService = new AuthService();
