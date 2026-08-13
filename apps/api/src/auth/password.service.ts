import { Injectable } from '@nestjs/common'
import argon2 from 'argon2'

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id })
  }

  /**
   * Returns false on malformed input instead of throwing: a corrupted stored
   * hash must read as "authentication failed", never as a 500 that tells an
   * attacker they found something interesting.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain)
    } catch {
      return false
    }
  }
}
