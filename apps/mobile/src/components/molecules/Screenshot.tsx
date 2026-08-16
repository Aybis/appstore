import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { paletteFor } from '../../utils/format';

type Props = {
  /** http(s) URL renders an image; anything else renders a placeholder. */
  url: string;
  index: number;
  width: number;
  height: number;
};

/**
 * One screenshot in the detail carousel. The mock provider emits `mock://`
 * URLs, which render as a deterministic two-tone panel with a fake app chrome
 * so the carousel reads correctly offline. Real https URLs render as images.
 */
export const Screenshot = ({ url, index, width, height }: Props) => {
  const isRemote = url.startsWith('http');

  if (isRemote) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.frame, { width, height }]}
        resizeMode="cover"
        accessibilityLabel={`Screenshot ${index + 1}`}
      />
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
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
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
