import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadEnv } from './config/env'

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env)
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('v1', { exclude: ['health'] })
  await app.listen(env.PORT)
  new Logger('bootstrap').log(`API listening on port ${env.PORT}`)
}

void bootstrap()
