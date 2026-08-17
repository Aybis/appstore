import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadEnv } from './config/env'

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env)
  const app = await NestFactory.create(AppModule)
  // `download/:artifactId/stream` sits outside the versioned prefix: the URL is
  // embedded in a signed ticket and handed to the platform downloader, so it is
  // a stable capability URL rather than part of the REST surface.
  app.setGlobalPrefix('v1', { exclude: [
      'health',
      'download/:artifactId/stream',
      'download/:artifactId/manifest.plist',
    ] })
  await app.listen(env.PORT)
  new Logger('bootstrap').log(`API listening on port ${env.PORT}`)
}

void bootstrap()
