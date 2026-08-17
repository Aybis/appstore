import { Injectable } from '@nestjs/common'
import { AndroidAdapter } from './android.adapter'
import { ItmsServicesAdapter } from './itms-services.adapter'
import type { DistributionPort } from './distribution.port'
import type { CatalogPlatform } from '../catalog/catalog.service'

/**
 * Resolves the adapter for a platform.
 *
 * Callers ask for a platform and get a port — they never branch on it, which
 * is the point: adding MarketplaceKit later is a new adapter plus a line here,
 * not an edit to every call site.
 */
@Injectable()
export class DistributionRegistry {
  private readonly adapters: Map<CatalogPlatform, DistributionPort>

  constructor(android: AndroidAdapter, itms: ItmsServicesAdapter) {
    this.adapters = new Map<CatalogPlatform, DistributionPort>([
      [android.platform, android],
      [itms.platform, itms],
    ])
  }

  for(platform: CatalogPlatform): DistributionPort {
    const adapter = this.adapters.get(platform)
    if (!adapter) throw new Error(`No distribution adapter for "${platform}"`)
    return adapter
  }
}
