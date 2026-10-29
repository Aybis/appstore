import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, themedStyles, typography } from '../../theme/tokens';
import { SectionTitle } from '../atoms';
import { ChipRow, SearchBar, type ChipOption } from '../molecules';
import { FeaturedRail } from './FeaturedRail';
import { FadeIn, STAGGER_STEP_MS } from '../../motion';
import { SORT_OPTIONS, type SortKey } from '../../utils/sort';
import { CATEGORIES, type App, type Category } from '../../types';
import { useT } from '../../i18n';
import { useAuth } from '../../services/auth';

const ALL = 'all';
type CategoryKey = Category | typeof ALL;

/**
 * Categories themselves are DATA — they come from `apps.category` in the API and
 * are not translated. Only the synthetic "All" entry is a UI string.
 */
const categoryOptions = (
  allLabel: string,
  categories: readonly Category[],
): readonly ChipOption<CategoryKey>[] => [
  { key: ALL, label: allLabel },
  ...categories.map((category) => ({ key: category, label: category })),
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
  /** Categories the catalog actually has; the built-in list is only the fallback. */
  categories?: readonly Category[];
  /** Browse mode: the rails below carry their own headings, so the list heading and sort are hidden. */
  home?: boolean;
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
  categories = CATEGORIES,
  home = false,
}: Props) => {
  const t = useT();
  const { user } = useAuth();

  return (
  <View style={styles.header}>
    {home && user && (
      <FadeIn delayMs={0}>
        <Text style={styles.welcome}>{t('discover.welcome', { name: user.name })}</Text>
      </FadeIn>
    )}

    <FadeIn delayMs={1 * BLOCK_STAGGER_MS}>
      <SearchBar
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('discover.searchPlaceholder')}
      />
    </FadeIn>

    <FadeIn delayMs={2 * BLOCK_STAGGER_MS}>
      <ChipRow
        options={categoryOptions(t('category.all'), categories)}
        selectedKey={category ?? ALL}
        onSelect={(key) => onCategoryChange(key === ALL ? null : key)}
        accessibilityLabel={t('discover.allApps')}
      />
    </FadeIn>

    {showFeatured && (
      <FadeIn delayMs={3 * BLOCK_STAGGER_MS}>
        <FeaturedRail apps={featured} cardWidth={featuredCardWidth} />
      </FadeIn>
    )}

    {!home && (
    <FadeIn delayMs={4 * BLOCK_STAGGER_MS}>
      <View style={styles.listHeading}>
        <SectionTitle>{listHeading}</SectionTitle>
        {resultCount !== null && (
          <Text style={styles.count}>
            {t(
              resultCount === 1 ? 'discover.count_one' : 'discover.count_other',
              { count: resultCount },
            )}
          </Text>
        )}
      </View>
    </FadeIn>
    )}

    {!home && (
    <FadeIn delayMs={5 * BLOCK_STAGGER_MS}>
      <ChipRow
        options={SORT_OPTIONS.map((option) => ({
          key: option.key,
          label: t(option.labelKey),
        }))}
        selectedKey={sort}
        onSelect={onSortChange}
        accessibilityLabel={t('sort.name')}
      />
    </FadeIn>
    )}
  </View>
  );
};

const styles = themedStyles(() => ({
  header: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  welcome: {
    ...typography.display,
    color: colors.text,
  },
  count: {
    ...typography.caption,
    color: colors.textTertiary,
  },
}));
