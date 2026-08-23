import { Inject, Injectable } from '@nestjs/common'
import { desc } from 'drizzle-orm'
import { auditEvents } from '../db/audit.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export interface AuditEvent {
  actorId: string | null
  action: string
  subjectType: string
  subjectId: string
  metadata?: Record<string, unknown>
}

export interface AuditRecord extends AuditEvent {
  id: string
  metadata: Record<string, unknown>
  createdAt: Date
}

/**
 * Writes and reads the append-only audit log.
 *
 * This service is a convenience, not a boundary: the append-only guarantee is
 * the REVOKE in migration 0007, so code that goes around this class still
 * cannot rewrite an event. Callers should record AFTER the work they are
 * describing has committed — an event is a statement that something happened,
 * and `record` runs in its own transaction, so calling it inside a transaction
 * that later rolls back would leave a claim about work that never landed.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(orgId: string, event: AuditEvent): Promise<void> {
    await withTenant(this.db, orgId, (tx) =>
      tx.insert(auditEvents).values({
        orgId,
        actorId: event.actorId,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        metadata: event.metadata ?? {},
      }),
    )
  }

  async list(orgId: string, limit: number): Promise<AuditRecord[]> {
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx
        .select()
        .from(auditEvents)
        // The secondary sort on id is load-bearing: two events recorded inside
        // the same transaction share created_at to the microsecond (now() is
        // transaction time), so created_at alone leaves their order to the
        // planner and the newest-first assertion flakes.
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(limit),
    )

    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.createdAt,
    }))
  }
}
