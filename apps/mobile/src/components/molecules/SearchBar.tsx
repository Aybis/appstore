import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { SearchGlyph } from '../atoms';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
};

/** Glyph + input + clear button acting as one search control. */
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
