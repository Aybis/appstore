import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../constants/theme';
import { formatCount, formatRating } from '../../utils/format';

type Props = {
  rating: number;
  count?: number;
  size?: number;
  /** Hide the numeric value and show stars only. */
  starsOnly?: boolean;
};

const STAR_COUNT = 5;

/**
 * Star row rendered with glyphs (no icon dependency). Only ★/☆ are used —
 * half-star glyphs are missing from several stock Android fonts and render as
 * tofu, so a half point is rounded up and the numeric value carries precision.
 */
export const RatingStars = ({
  rating,
  count,
  size = 13,
  starsOnly = false,
}: Props) => {
  const stars = Array.from({ length: STAR_COUNT }, (_, index) =>
    rating - index >= 0.5 ? '★' : '☆',
  );

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Rated ${formatRating(rating)} out of 5${
        count ? `, ${count} ratings` : ''
      }`}
    >
      <Text style={[styles.stars, { fontSize: size }]}>{stars.join('')}</Text>
      {!starsOnly && (
        <Text style={[styles.value, { fontSize: size }]}>
          {formatRating(rating)}
          {count !== undefined ? ` (${formatCount(count)})` : ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stars: {
    color: colors.star,
    letterSpacing: 1,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
