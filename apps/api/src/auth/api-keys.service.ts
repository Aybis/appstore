import { randomBytes } from 'node:crypto'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { AuditService } from '../audit/audit.service'
import { PasswordService } from './password.service'
import { apiKeys, type ApiKeyRole } from '../db/api-keys.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

/** Recognisable at a glance in a log or a paste, and greppable in a leak scan. */
const KEY_PREFIX = 'maya_ci_'

/** 32 bytes of randomness. Not a password: there is no dictionary to slow. */
const SECRET_BYTES = 32

/** Characters of the random part kept in the stored, displayable prefix. */
const PREFIX_CHARS = 8

/**
 * A UUID is 16 bytes, which is always exactly 22 unpadded base64url characters.
 *
 * Sliced by length rather than found by separator, because the base64url
 * alphabet INCLUDES `_` — so an org id that happened to encode with one would
 * split in the wrong place and authenticate as nothing. Fixed width has no
 * such failure mode.
 */
const ORG_CHARS = 22

/**
 * The key carries its own organization: `maya_ci_<org>_<secret>`.
 *
 * Not decoration — it is what lets authentication respect RLS. `api_keys` is
 * FORCE row-secured like every other tenant table, so a row can only be read
 * inside `withTenant(orgId)`. Authenticating a key means finding a row whose
 * org you do not yet know, which is a genuine chicken-and-egg: the first
 * version of this looked the key up on the unscoped connection, matched
 * nothing because the policy hid every row, and returned 401 for a perfectly
 * valid key.
 *
 * Encoding the org in the credential resolves it without loosening the policy
 * or handing this one query a privileged connection. The org id is not a
 * secret — anyone holding the key can act in that org anyway — and the random
 * half is what authenticates.
 */
const encodeOrg = (orgId: string): string =>
  Buffer.from(orgId.replace(/-/g, ''), 'hex').toString('base64url')

const decodeOrg = (encoded: string): string | null => {
  try {
    const hex = Buffer.from(encoded, 'base64url').toString('hex')
    if (hex.length !== 32) return null
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch {
    return null
  }
}

export interface ApiKeySummary {
  id: string
  name: string
  prefix: string
  role: ApiKeyRole
  expiresAt: Date
  revokedAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
}

export interface MintedApiKey extends ApiKeySummary {
  /** Returned EXACTLY ONCE, at creation. Never recoverable afterwards. */
  secret: string
}

/**
 * Credentials for build servers.
 *
 * A pipeline cannot hold a password, so without this a release is pushed with
 * some engineer's own access token — which means either a human runs every
 * deploy by hand, or a CI secret store holds a credential that can do
 * everything that person can.
 *
 * The role is capped at `publisher` by a CHECK constraint in migration 0011
 * (security review S-8), not by this file. Everything here could be refactored
 * away and the cap would hold, which is the entire point: a CI key able to
 * mint admins is a privilege-escalation primitive, and CI tokens leak into
 * build logs and repository forks far more readily than passwords do.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string): Promise<ApiKeySummary[]> {
    return withTenant(this.db, orgId, (tx) =>
      tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          role: apiKeys.role,
          expiresAt: apiKeys.expiresAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .orderBy(desc(apiKeys.createdAt)),
    )
  }

  /**
   * Mints a key. The secret is returned here and never again.
   *
   * Hashed with argon2id like a password, despite being our own randomness —
   * not because there is a dictionary to slow down, but because the cost of
   * doing so is paid once per CI run rather than per request, and it keeps one
   * rule ("secrets in this database are argon2id") instead of two.
   */
  async mint(
    orgId: string,
    actorId: string,
    name: string,
    role: ApiKeyRole,
    expiresInDays: number,
  ): Promise<MintedApiKey> {
    const random = randomBytes(SECRET_BYTES).toString('base64url')
    const secret = `${KEY_PREFIX}${encodeOrg(orgId)}_${random}`
    // Identifies without authenticating: enough to say WHICH key in a list,
    // useless for acting as it. Includes the org part, so it stays globally
    // unique without needing the random half to be long.
    const prefix = `${KEY_PREFIX}${encodeOrg(orgId)}_${random.slice(0, PREFIX_CHARS)}`
    const secretHash = await this.passwords.hash(secret)

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const [row] = await withTenant(this.db, orgId, (tx) =>
      tx
        .insert(apiKeys)
        .values({ orgId, name, prefix, secretHash, role, createdBy: actorId, expiresAt })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          role: apiKeys.role,
          expiresAt: apiKeys.expiresAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
        }),
    )

    await this.audit.record(orgId, {
      actorId,
      action: 'api_key.minted',
      subjectType: 'api_key',
      subjectId: row!.id,
      metadata: { name, role, prefix, expiresAt: expiresAt.toISOString() },
    })

    return { ...row!, secret }
  }

  async revoke(orgId: string, actorId: string, id: string, reason = 'revoked'): Promise<void> {
    const revoked = await withTenant(this.db, orgId, (tx) =>
      tx
        .update(apiKeys)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id }),
    )

    if (!revoked[0]) throw new NotFoundException('No such active API key')

    await this.audit.record(orgId, {
      actorId,
      action: 'api_key.revoked',
      subjectType: 'api_key',
      subjectId: id,
      metadata: { reason },
    })
  }

  /**
   * Authenticates a presented secret.
   *
   * The org comes out of the key itself (see encodeOrg), so the lookup runs
   * inside `withTenant` like every other read of a tenant table — no
   * privileged connection, no policy exception.
   *
   * Looked up by prefix, which is indexed and unique, then verified against
   * the argon2 hash. Matching on the hash directly is not possible: argon2
   * embeds a per-row salt, so there is nothing to compare without first
   * knowing which row to compare against.
   */
  async authenticate(
    secret: string,
  ): Promise<{ orgId: string; keyId: string; role: ApiKeyRole } | null> {
    if (!secret.startsWith(KEY_PREFIX)) return null

    const body = secret.slice(KEY_PREFIX.length)
    const encodedOrg = body.slice(0, ORG_CHARS)
    if (body[ORG_CHARS] !== '_') return null

    const orgId = decodeOrg(encodedOrg)
    if (!orgId) return null

    const random = body.slice(ORG_CHARS + 1)
    const prefix = `${KEY_PREFIX}${encodedOrg}_${random.slice(0, PREFIX_CHARS)}`

    const [row] = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({
          id: apiKeys.id,
          orgId: apiKeys.orgId,
          secretHash: apiKeys.secretHash,
          role: apiKeys.role,
          expiresAt: apiKeys.expiresAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.prefix, prefix))
        .limit(1),
    )

    if (!row) return null
    if (row.revokedAt) return null
    if (row.expiresAt.getTime() <= Date.now()) return null

    const ok = await this.passwords.verify(row.secretHash, secret)
    if (!ok) return null

    // Best-effort: a failed timestamp write must not refuse a valid key.
    void withTenant(this.db, row.orgId, (tx) =>
      tx.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)),
    ).catch(() => undefined)

    return { orgId: row.orgId, keyId: row.id, role: row.role }
  }
}
