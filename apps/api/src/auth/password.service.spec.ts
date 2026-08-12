import { describe, expect, it } from 'vitest'
import { PasswordService } from './password.service'

describe('PasswordService', () => {
  const service = new PasswordService()

  it('produces an argon2id hash', async () => {
    const hash = await service.hash('correct horse battery staple')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('produces a different hash for the same password each time', async () => {
    const [first, second] = await Promise.all([service.hash('same'), service.hash('same')])
    expect(first).not.toBe(second)
  })

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct horse battery staple')
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct horse battery staple')
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false)
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false)
  })
})
