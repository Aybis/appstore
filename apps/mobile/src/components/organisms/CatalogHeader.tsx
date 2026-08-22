import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { ChipRow, SearchBar, type ChipOption } from '../molecules';
import { FeaturedRail } from './FeaturedRail';
import { FadeIn, STAGGER_STEP_MS } from '../../motion';
import { SORT_OPTIONS, type SortKey } from '../../utils/sort';
import { CATEGORIES, type App, type Category } from '../../types';

const ALL = 'all';
type CategoryKey = Category | typeof ALL;

const CATEGORY_OPTIONS: readonly ChipOption<CategoryKey>[] = [
  { key: ALL, label: 'All' },
  ...CATEGORIES.map((category) => ({ key: category, label: category })),
];

/** Each top-level block enters a beat after the one above it. */
const BLOCK_STAGGER_MS = STAGGER_STEP_MS * 2;

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
    <FadeIn delayMs={0 * BLOCK_STAGGER_MS}>
      <View style={styles.titleBlock}>
        <Text style={styles.greeting}>Internal apps</Text>
        <Text style={styles.subtitle}>
          Company-approved builds for Android and iOS.
        </Text>
      </View>
    </FadeIn>

    <FadeIn delayMs={1 * BLOCK_STAGGER_MS}>
      <SearchBar value={query} onChangeText={onQueryChange} />
    </FadeIn>

    <FadeIn delayMs={2 * BLOCK_STAGGER_MS}>
      <ChipRow
        options={CATEGORY_OPTIONS}
        selectedKey={category ?? ALL}
        onSelect={(key) => onCategoryChange(key === ALL ? null : key)}
        accessibilityLabel="Filter by category"
      />
    </FadeIn>

    {showFeatured && (
      <FadeIn delayMs={3 * BLOCK_STAGGER_MS}>
        <FeaturedRail apps={featured} cardWidth={featuredCardWidth} />
      </FadeIn>
    )}

    <FadeIn delayMs={4 * BLOCK_STAGGER_MS}>
      <View style={styles.listHeading}>
        <SectionTitle>{listHeading}</SectionTitle>
        {resultCount !== null && (
          <Text style={styles.count}>
            {resultCount} {resultCount === 1 ? 'app' : 'apps'}
          </Text>
        )}
      </View>
    </FadeIn>

    <FadeIn delayMs={5 * BLOCK_STAGGER_MS}>
      <ChipRow
        options={SORT_OPTIONS}
        selectedKey={sort}
        onSelect={onSortChange}
        accessibilityLabel="Sort apps"
      />
    </FadeIn>
  </View>
);

const styles = StyleSheet.create({
  header: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  greeting: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
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
