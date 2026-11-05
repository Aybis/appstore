import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkForUpdate, toUpdateInfo, type VersionCheckResponse } from './check';

const answer = (overrides: Partial<VersionCheckResponse> = {}): VersionCheckResponse => ({
  packageId: 'com.maya.hrportal',
  platform: 'android',
  currentVersion: '1.0.0',
  latestVersion: '1.0.1',
  updateAvailable: true,
  severity: 'minor',
  updateRequired: false,
  releaseNotes: '',
  publishedAt: null,
  storeUrl: 'maya://app/hr-portal',
  ...overrides,
});

describe('toUpdateInfo', () => {
  it('maps a required update to the immediate flow, like Play', () => {
    expect(toUpdateInfo(answer({ updateRequired: true, severity: 'major' })).flow).toBe('immediate');
    expect(toUpdateInfo(answer()).flow).toBe('flexible');
  });

  it('allows in place only with a download URL that has not expired', () => {
    expect(toUpdateInfo(answer()).canUpdateInPlace).toBe(false);
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 1).toISOString();
    expect(toUpdateInfo(answer({ downloadUrl: 'https://x/y', downloadExpiresAt: future })).canUpdateInPlace).toBe(true);
    expect(toUpdateInfo(answer({ downloadUrl: 'https://x/y', downloadExpiresAt: past })).canUpdateInPlace).toBe(false);
  });
});

describe('checkForUpdate', () => {
  const options = {
    apiBaseUrl: 'https://maya.test/',
    org: 'acme',
    packageId: 'com.maya.hrportal',
    platform: 'android' as const,
    currentVersion: '1.0.0',
    installKey: 'install-0000-aaaa',
  };

  afterEach(() => vi.unstubAllGlobals());

  it('asks the public version check, with the install key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(answer()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const update = await checkForUpdate(options);

    expect(update?.latestVersion).toBe('1.0.1');
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe('https://maya.test/v1/version-check');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      org: 'acme',
      packageId: 'com.maya.hrportal',
      platform: 'android',
      version: '1.0.0',
      install: 'install-0000-aaaa',
    });
  });

  it('returns null when current', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(answer({ updateAvailable: false })), { status: 200 }));
    expect(await checkForUpdate(options)).toBeNull();
  });

  it('lets the user in when the store cannot be reached, rather than forcing an update', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Network request failed');
    });
    expect(await checkForUpdate(options)).toBeNull();
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 503 }));
    expect(await checkForUpdate(options)).toBeNull();
  });
});
