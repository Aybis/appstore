import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Shimmer } from '../../motion';
import { paletteFor } from '../../utils/format';

type Props = {
  /** http(s) URL renders an image; anything else renders a placeholder. */
  url: string;
  index: number;
  width: number;
  height: number;
};

const IMAGE_TRANSITION_MS = 220;

/**
 * One screenshot in the detail carousel. The mock provider emits `mock://`
 * URLs, which render as a deterministic two-tone panel with a fake app chrome
 * so the carousel reads correctly offline. Real https URLs render as images,
 * with a shimmer standing in for the frame until the image reports loaded.
 */
export const Screenshot = ({ url, index, width, height }: Props) => {
  const isRemote = url.startsWith('http');
  const [loaded, setLoaded] = useState(false);

  if (isRemote) {
    return (
      <View style={[styles.frame, { width, height }]}>
        {!loaded && (
          <Shimmer
            width={width}
            height={height}
            borderRadius={radius.lg}
            style={StyleSheet.absoluteFill}
          />
        )}
        <ExpoImage
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={IMAGE_TRANSITION_MS}
          onLoad={() => setLoaded(true)}
          accessibilityLabel={`Screenshot ${index + 1}`}
        />
      </View>
    );
  }

  const [base, light] = paletteFor(url);

  return (
    <View
      style={[styles.frame, styles.placeholder, { width, height }]}
      accessibilityLabel={`Screenshot ${index + 1} placeholder`}
    >
      <View style={[styles.header, { backgroundColor: base }]}>
        <View style={styles.headerBar} />
        <View style={[styles.headerBar, styles.headerBarShort]} />
      </View>
      <View style={styles.body}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: light }]} />
            <View style={styles.rowLines}>
              <View style={styles.line} />
              <View style={[styles.line, styles.lineShort]} />
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.caption}>Screenshot {index + 1}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    // A hairline of light, not a grey stroke — keeps a bright screenshot from
    // bleeding straight into the near-black canvas at its edge.
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceInset,
  },
  placeholder: {
    justifyContent: 'flex-start',
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerBar: {
    height: 8,
    width: '62%',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  headerBarShort: {
    width: '38%',
    opacity: 0.6,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    opacity: 0.5,
  },
  rowLines: {
    flex: 1,
    gap: 6,
  },
  line: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  lineShort: {
    width: '55%',
  },
  caption: {
    ...typography.label,
    color: colors.textTertiary,
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
  },
});
