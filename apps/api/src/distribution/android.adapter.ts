import { Injectable } from '@nestjs/common'
import type {
  DistributionPort,
  DistributionSubject,
  InstallDescriptor,
} from './distribution.port'
import type { CatalogPlatform } from '../catalog/catalog.service'

/**
 * Android in-house distribution.
 *
 * Android is the simple case: the client fetches the APK bytes and hands the
 * file to the system package installer via a content:// URI. No manifest, no
 * signing ceremony on our side — the store only has to serve the artifact.
 *
 * The device still needs the REQUEST_INSTALL_PACKAGES permission and a per-app
 * "install unknown apps" grant, but both are client-side and cannot be
 * satisfied by anything this adapter returns.
 */
@Injectable()
export class AndroidAdapter implements DistributionPort {
  readonly platform: CatalogPlatform = 'android'

  describe(subject: DistributionSubject): InstallDescriptor {
    return { url: subject.artifactUrl, mode: 'stream' }
  }
}
