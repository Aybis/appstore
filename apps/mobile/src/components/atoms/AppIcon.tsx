import { Image } from 'expo-image';
import { useState } from 'react';

import { colors } from '../../theme/tokens';
import { IconPlaceholder } from './IconPlaceholder';

type Props = {
  app: { slug: string; name: string; iconUrl?: string };
  size?: number;
};

/**
 * An app's icon: the uploaded image when there is one, the gradient initials
 * when there is not or when it fails to load. Every catalog surface uses this
 * rather than IconPlaceholder directly, so an upload shows up everywhere at once.
 */
export const AppIcon = ({ app, size = 56 }: Props) => {
  const [failed, setFailed] = useState(false);

  if (!app.iconUrl || failed) {
    return <IconPlaceholder seed={app.slug} name={app.name} size={size} />;
  }

  return (
    <Image
      source={app.iconUrl}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.surfaceStrong,
      }}
      contentFit="cover"
      transition={150}
      cachePolicy="disk"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
};
