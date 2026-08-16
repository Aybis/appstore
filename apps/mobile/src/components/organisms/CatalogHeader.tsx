import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { ChipRow, SearchBar, type ChipOption } from '../molecules';
import { FeaturedRail } from './FeaturedRail';
import { SORT_OPTIONS, type SortKey } from '../../utils/sort';
import { CATEGORIES, type App, type Category } from '../../types';

const ALL = 'all';
type CategoryKey = Category | typeof ALL;

const CATEGORY_OPTIONS: readonly ChipOption<CategoryKey>[] = [
  { key: ALL, label: 'All' },
  ...CATEGORIES.map((category) => ({ key: category, label: category })),
];

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  category: Category | null;
  onCategoryChange: (next: Category | null) => void;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  featured: readonly App[];
  showFeatured: boolean;
  featuredCardWidth: number;
  listHeading: string;
  /** null while loading — hides the count rather than flashing "0 apps". */
  resultCount: number | null;
};

/** Everything above the catalog list: search, filters, featured rail, sort. */
export const CatalogHeader = ({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  featured,
  showFeatured,
  featuredCardWidth,
  listHeading,
  resultCount,
}: Props) => (
  <View style={styles.header}>
    <Text style={styles.greeting}>Internal apps</Text>
    <Text style={styles.subtitle}>
      Company-approved builds for Android and iOS.
    </Text>

    <SearchBar value={query} onChangeText={onQueryChange} />

    <ChipRow
      options={CATEGORY_OPTIONS}
      selectedKey={category ?? ALL}
      onSelect={(key) => onCategoryChange(key === ALL ? null : key)}
      accessibilityLabel="Filter by category"
    />

    {showFeatured && (
      <FeaturedRail apps={featured} cardWidth={featuredCardWidth} />
    )}

    <View style={styles.listHeading}>
      <SectionTitle>{listHeading}</SectionTitle>
      {resultCount !== null && (
        <Text style={styles.count}>
          {resultCount} {resultCount === 1 ? 'app' : 'apps'}
        </Text>
      )}
    </View>

    <ChipRow
      options={SORT_OPTIONS}
      selectedKey={sort}
      onSelect={onSortChange}
      accessibilityLabel="Sort apps"
    />
  </View>
);

const styles = StyleSheet.create({
  header: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  greeting: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.md,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  count: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
