import { Global, Module, type Provider } from '@nestjs/common'
import { loadEnv } from '../config/env'
import { createDb, type Database } from './client'

export const DATABASE = Symbol('DATABASE')
export type { Database }

const databaseProvider: Provider = {
  provide: DATABASE,
  useFactory: (): Database => createDb(loadEnv(process.env).DATABASE_URL).db,
}

@Global()
@Module({ providers: [databaseProvider], exports: [DATABASE] })
export class DatabaseModule {}
