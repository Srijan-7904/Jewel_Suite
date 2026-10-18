import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface AuditRecord {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: string | null;
  created_at: string;
}

export class AuditRepository {
  log(data: {
    user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    metadata?: Record<string, unknown> | string | null;
  }): void {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const metadataStr = typeof data.metadata === 'object' && data.metadata !== null
      ? JSON.stringify(data.metadata)
      : (data.metadata || null);

    let validUserId = data.user_id || null;
    if (validUserId) {
      const userRow = db.prepare('SELECT 1 FROM users WHERE id = ?').get(validUserId);
      if (!userRow) {
        validUserId = null;
      }
    }

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      validUserId,
      data.action,
      data.entity_type,
      data.entity_id || null,
      metadataStr,
      now
    );
  }

  getRecent(limit = 50): AuditRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as AuditRecord[];
  }
}

export const auditRepository = new AuditRepository();
