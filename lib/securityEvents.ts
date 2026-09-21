import { getDataSource } from '@/lib/typeorm';

export type SecurityEventType =
  | 'login_ok'
  | 'login_fail'
  | 'logout'
  | 'password_reset'
  | 'email_change'
  | 'session_revoked'
  | 'admin_login_ok'
  | 'admin_login_fail'
  | 'admin_logout'
  | 'admin_action'
  | 'admin_dump'
  | 'admin_snapshot'
  | 'password_reset_request';

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: number | null;
  email?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown> | null;
}

/**
 * Appends an entry to the audit trail. Never throws and never blocks the
 * caller: a failing audit write must not break login or an admin action.
 */
export const logSecurityEvent = async (event: SecurityEventInput): Promise<void> => {
  try {
    const dataSource = await getDataSource();
    await dataSource.query(
      'INSERT INTO security_events (type, user_id, email, ip, detail) VALUES ($1, $2, $3, $4, $5)',
      [
        event.type,
        event.userId ?? null,
        event.email ?? null,
        event.ip ?? null,
        event.detail ? JSON.stringify(event.detail) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to write security event:', error);
  }
};
