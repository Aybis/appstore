import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
};

/** Magnifier drawn from primitives — avoids pulling in an icon package. */
const SearchGlyph = () => (
  <View style={styles.glyph}>
    <View style={styles.glyphLens} />
    <View style={styles.glyphHandle} />
  </View>
);

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search apps, teams, keywords',
}: Props) => (
  <View style={styles.container}>
    <SearchGlyph />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      style={styles.input}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      clearButtonMode="while-editing"
      accessibilityLabel="Search apps"
    />
    {value.length > 0 && (
      <Pressable
        onPress={() => onChangeText('')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Clear search"
        style={styles.clear}
      >
        <Text style={styles.clearLabel}>✕</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  glyph: {
    width: 16,
    height: 16,
    justifyContent: 'center',
  },
  glyphLens: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: colors.textTertiary,
  },
  glyphHandle: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 6,
    height: 1.6,
    borderRadius: 1,
    backgroundColor: colors.textTertiary,
    transform: [{ rotate: '45deg' }],
  },
  clear: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  clearLabel: {
    fontSize: 11,
    lineHeight: 13,
    color: colors.surface,
    fontWeight: '700',
  },
});
