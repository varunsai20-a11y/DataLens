import { pool } from './db';
import logger from '../utils/logger';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  status?: 'SUCCESS' | 'FAILED' | 'REJECTED';
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'authorization',
  'secret',
  'apikey',
  'credit_card',
  'file_content',
]);

/**
 * Sanitizes metadata by removing or redacting sensitive keys.
 */
export function sanitizeAuditMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') return {};

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeAuditMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export const auditService = {
  /**
   * Non-blocking audit logger. Persists audit event to database safely.
   * Failures do NOT interrupt or fail normal business requests.
   */
  async logEvent(params: CreateAuditLogParams): Promise<void> {
    try {
      const cleanMetadata = sanitizeAuditMetadata(params.metadata);
      const query = `
        INSERT INTO audit_logs 
        (user_id, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      const queryParams = [
        params.userId || null,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.status || 'SUCCESS',
        params.ipAddress || null,
        params.userAgent || null,
        params.requestId || null,
        JSON.stringify(cleanMetadata),
      ];

      await pool.query(query, queryParams);
      logger.info(`Audit Event Logged: [${params.action}] status=${params.status || 'SUCCESS'} user=${params.userId || 'anonymous'}`);
    } catch (err: any) {
      // Security Rule: Audit log failures must NEVER fail user operations
      logger.error('Failed to log audit event to database', { error: err.message, action: params.action });
    }
  },

  /**
   * Retrieves audit logs for an authenticated user or system view.
   */
  async getAuditLogs(userId?: string, limit = 50, offset = 0): Promise<{ logs: AuditLog[]; total: number }> {
    const countQuery = userId
      ? 'SELECT COUNT(*)::int as total FROM audit_logs WHERE user_id = $1'
      : 'SELECT COUNT(*)::int as total FROM audit_logs';
    const countParams = userId ? [userId] : [];

    const selectQuery = userId
      ? `SELECT id, user_id, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata, created_at
         FROM audit_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`
      : `SELECT id, user_id, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`;
    const selectParams = userId ? [userId, limit, offset] : [limit, offset];

    const [countRes, selectRes] = await Promise.all([
      pool.query(countQuery, countParams),
      pool.query(selectQuery, selectParams),
    ]);

    return {
      total: countRes.rows[0]?.total || 0,
      logs: selectRes.rows.map((row) => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      })),
    };
  },
};
