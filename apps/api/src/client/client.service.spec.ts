import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ClientService, resolvePortalUrl } from './client.service'

/**
 * These tests exist for one claim in particular.
 *
 * The portal prints a SHA-256 beside the download and tells people to check it
 * before installing. That instruction is worth following only if the server
 * refuses to serve bytes that do not match — otherwise the page keeps
 * displaying a correct-looking fingerprint for a binary that has been swapped,
 * which is worse than printing nothing at all.
 */
describe('ClientService', () => {
  let root: string
  let service: ClientService

  const APK = Buffer.from('PK\x03\x04 pretend this is a signed MAYA build')
  const digest = createHash('sha256').update(APK).digest('hex')

  const manifest = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      android: {
        version: '1.0.0',
        versionCode: 1,
        file: 'android/maya-1.0.0.apk',
        sha256: digest,
        sizeBytes: APK.length,
        packageId: 'com.internal.appstore',
        minSdk: 24,
        minOsLabel: 'Android 7.0',
        abis: ['arm64-v8a'],
        signerSha256: 'aa',
        releasedAt: '2026-08-23T07:20:37.787Z',
        easBuildId: 'b1949c32',
        gitCommit: '881a380f',
        ...overrides,
      },
      ios: null,
    })

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-client-'))
    process.env.ARTIFACT_STORE = root
    await fs.mkdir(path.join(root, 'client', 'android'), { recursive: true })
    await fs.writeFile(path.join(root, 'client', 'android', 'maya-1.0.0.apk'), APK)
    await fs.writeFile(path.join(root, 'client', 'manifest.json'), manifest())
    service = new ClientService()
  })

  afterEach(async () => {
    delete process.env.ARTIFACT_STORE
    await fs.rm(root, { recursive: true, force: true })
  })

  it('lists the published build', async () => {
    const builds = await service.available()
    expect(builds).toHaveLength(1)
    expect(builds[0]).toMatchObject({ platform: 'android', version: '1.0.0', sha256: digest })
  })

  it('does not leak the manifest wholesale', async () => {
    // easBuildId and gitCommit describe our pipeline, not the download.
    const [build] = await service.available()
    expect(build).not.toHaveProperty('easBuildId')
    expect(build).not.toHaveProperty('gitCommit')
    expect(build).not.toHaveProperty('file')
  })

  it('serves a build whose bytes match the manifest', async () => {
    const resolved = await service.resolve('android')
    expect(resolved.filename).toBe('maya-1.0.0.apk')
    expect(resolved.contentType).toBe('application/vnd.android.package-archive')
  })

  it('REFUSES a build whose bytes were swapped after publication', async () => {
    // Same length, different content — the case a size check alone would miss.
    const tampered = Buffer.from(APK)
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff
    await fs.writeFile(path.join(root, 'client', 'android', 'maya-1.0.0.apk'), tampered)

    await expect(service.resolve('android')).rejects.toThrow(/verification/i)
  })

  it('refuses a build whose size disagrees with the manifest', async () => {
    await fs.writeFile(
      path.join(root, 'client', 'manifest.json'),
      manifest({ sizeBytes: APK.length + 10 }),
    )
    await expect(service.resolve('android')).rejects.toThrow(/verification/i)
  })

  it('does not let a manifest path escape the store root', async () => {
    await fs.writeFile(
      path.join(root, 'client', 'manifest.json'),
      manifest({ file: '../../../../etc/passwd' }),
    )
    await expect(service.resolve('android')).rejects.toThrow()
  })

  it('reports a platform with no build as not found, not as an error', async () => {
    await expect(service.resolve('ios')).rejects.toThrow(/No MAYA build/i)
  })

  it('treats a missing manifest as "nothing published yet"', async () => {
    await fs.rm(path.join(root, 'client', 'manifest.json'))
    expect(await service.available()).toEqual([])
  })
})

describe('resolvePortalUrl', () => {
  it('prefers an explicit PORTAL_URL', () => {
    expect(resolvePortalUrl('https://maya.muchtar.dev', ['http://localhost:5173'])).toBe(
      'https://maya.muchtar.dev',
    )
  })

  it('skips loopback origins, which no phone can reach', () => {
    // The whole point: localhost is first in CORS_ORIGINS in every dev setup,
    // and a QR encoding it fails for everyone who scans it.
    expect(
      resolvePortalUrl('', ['http://localhost:5173', 'http://192.168.1.16:5173']),
    ).toBe('http://192.168.1.16:5173')
  })

  it('recognises 127.0.0.1 and ::1 as loopback too', () => {
    expect(resolvePortalUrl('', ['http://127.0.0.1:5173', 'https://maya.example'])).toBe(
      'https://maya.example',
    )
    expect(resolvePortalUrl('', ['http://[::1]:5173', 'https://maya.example'])).toBe(
      'https://maya.example',
    )
  })

  it('returns null when every candidate is loopback, rather than a dead QR', () => {
    expect(resolvePortalUrl('', ['http://localhost:5173'])).toBeNull()
    expect(resolvePortalUrl('', [])).toBeNull()
  })

  it('trims a trailing slash so URLs do not double up', () => {
    expect(resolvePortalUrl('https://maya.muchtar.dev/', [])).toBe('https://maya.muchtar.dev')
  })
})
