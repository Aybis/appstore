import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../constants/theme';
import { formatCount, formatRating } from '../../utils/format';
import { StarIcon } from '../atoms';

type Props = {
  rating: number;
  count?: number;
  size?: number;
  /** Hide the numeric value and show stars only. */
  starsOnly?: boolean;
};

const STAR_COUNT = 5;

/**
 * Star row rendered with `StarIcon` (react-native-svg) rather than glyphs, so
 * weight and color are consistent with the rest of the icon family. Only a
 * full fill/outline pair is drawn — a half point is rounded up to a filled
 * star, same threshold the previous glyph version used, and the numeric value
 * carries the actual precision.
 */
export const RatingStars = ({
  rating,
  count,
  size = 13,
  starsOnly = false,
}: Props) => {
  // An unrated app renders nothing rather than five empty outlines. The old
  // glyph version drew five SOLID stars for every app regardless of its rating,
  // which is why the seeded catalog looked five-star across the board — the
  // outlines this replaced it with were correct but read as a row of dead
  // pixels on a card that simply has no ratings yet.
  if (rating <= 0) return null;

  const stars = Array.from(
    { length: STAR_COUNT },
    (_, index) => rating - index >= 0.5,
  );

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Rated ${formatRating(rating)} out of 5${
        count ? `, ${count} ratings` : ''
      }`}
    >
      <View style={styles.stars}>
        {stars.map((filled, index) => (
          <StarIcon key={index} size={size} color={colors.star} filled={filled} strokeWidth={1.5} />
        ))}
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
