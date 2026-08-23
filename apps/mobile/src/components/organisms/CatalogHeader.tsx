import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, themedStyles, typography } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { ChipRow, SearchBar, type ChipOption } from '../molecules';
import { FeaturedRail } from './FeaturedRail';
import { FadeIn, STAGGER_STEP_MS } from '../../motion';
import { SORT_OPTIONS, type SortKey } from '../../utils/sort';
import { CATEGORIES, type App, type Category } from '../../types';
import { useT } from '../../i18n';
import { useAuth } from '../../auth';

const ALL = 'all';
type CategoryKey = Category | typeof ALL;

/**
 * Categories themselves are DATA — they come from `apps.category` in the API and
 * are not translated. Only the synthetic "All" entry is a UI string.
 */
const categoryOptions = (allLabel: string): readonly ChipOption<CategoryKey>[] => [
  { key: ALL, label: allLabel },
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
}: Props) => {
  const t = useT();
  const { user } = useAuth();

  /*
   * First word only. Display names arrive as whatever the account holds —
   * "Abdul Muchtar", or an email local part for seeded accounts — and a
   * greeting reads better with one name than with a full record. Trimmed
   * because a trailing space would produce "Hello, ".
   */
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';

  return (
  <View style={styles.header}>
    <FadeIn delayMs={0 * BLOCK_STAGGER_MS}>
      <View style={styles.titleBlock}>
        {/* Greets by name when there is one, and falls back to the section
            title otherwise — a signed-out or half-restored session should read
            as a heading, never as "Hello, ". */}
        <Text style={styles.greeting}>
          {firstName ? t('discover.greeting', { name: firstName }) : t('discover.title')}
        </Text>
        <Text style={styles.subtitle}>{t('discover.subtitle')}</Text>
      </View>
    </FadeIn>

    <FadeIn delayMs={1 * BLOCK_STAGGER_MS}>
      <SearchBar
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('discover.searchPlaceholder')}
      />
    </FadeIn>

    <FadeIn delayMs={2 * BLOCK_STAGGER_MS}>
      <ChipRow
        options={categoryOptions(t('category.all'))}
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
  </View>
  );
};

const styles = themedStyles(() => ({
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
}));
