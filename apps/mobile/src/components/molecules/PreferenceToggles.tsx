import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { colors, spacing, themedStyles, typography } from '../../theme/tokens';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { MoonIcon, SunIcon } from '../atoms';

const HEIGHT = 32;
const INSET = 2;
const THUMB = HEIGHT - INSET * 2;

/** Slow enough to read as rolling, short enough not to make anyone wait. */
const ROLL = { duration: 380, easing: Easing.out(Easing.cubic) };

interface PillSwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  width: number;
  /** What the sliding knob shows for the current state. */
  thumb: ReactNode;
  /** Drawn on the track on each side, so both choices are always readable. */
  start?: ReactNode;
  end?: ReactNode;
  label: string;
  thumbWidth?: number;
}

/**
 * A two-position pill with a sliding knob.
 *
 * Built by hand rather than with the platform Switch: the system one cannot
 * carry an icon or a language code on its knob, and showing BOTH options on the
 * track is what makes it readable before anyone has touched it.
 */
const PillSwitch = ({
  value,
  onValueChange,
  width,
  thumb,
  start,
  end,
  label,
  thumbWidth = THUMB,
}: PillSwitchProps) => {
  const travel = width - INSET * 2 - thumbWidth;
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    position.value = withTiming(value ? 1 : 0, ROLL);
  }, [value, position]);

  // The knob ROLLS: one full turn over the slide, clockwise going right and
  // back the other way going left, so it settles upright at either end.
  const knob = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value * travel },
      { rotate: `${position.value * 360}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.track, { width }]}
    >
      <View style={styles.side}>{start}</View>
      <View style={styles.side}>{end}</View>
      <Animated.View style={[styles.thumb, { width: thumbWidth }, knob]}>{thumb}</Animated.View>
    </Pressable>
  );
};

/**
 * Appearance and language, reachable before signing in.
 *
 * Both settings also live on the profile screen, which is behind the sign-in
 * wall — so someone who reads Indonesian, or who cannot comfortably read light
 * text on a dark ground, had to get through the one screen they could not read
 * before they could fix it. That is the wrong way round.
 *
 * Sets an EXPLICIT theme preference, not 'system': somebody flipping this wants
 * the other appearance now. 'System' stays available on profile.
 */
export const PreferenceToggles = () => {
  const { scheme, setPreference } = useTheme();
  const { language, setLanguage } = useI18n();

  const isDark = scheme === 'dark';
  const isIndonesian = language === 'id';

  return (
    <View style={styles.row}>
      <PillSwitch
        width={64}
        value={isDark}
        onValueChange={(on) => setPreference(on ? 'dark' : 'light')}
        label={isDark ? 'Dark appearance' : 'Light appearance'}
        start={<SunIcon size={14} color={colors.textTertiary} />}
        end={<MoonIcon size={14} color={colors.textTertiary} />}
        thumb={
          isDark ? (
            <MoonIcon size={16} color={colors.text} />
          ) : (
            <SunIcon size={16} color={colors.text} />
          )
        }
      />

      <PillSwitch
        width={84}
        thumbWidth={40}
        value={isIndonesian}
        onValueChange={(on) => setLanguage(on ? 'id' : 'en')}
        label={isIndonesian ? 'Bahasa Indonesia' : 'English'}
        start={<Text style={styles.code}>EN</Text>}
        end={<Text style={styles.code}>ID</Text>}
        thumb={<Text style={styles.codeActive}>{isIndonesian ? 'ID' : 'EN'}</Text>}
      />
    </View>
  );
};

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: INSET,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    left: INSET,
    top: INSET,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  code: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeActive: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
}));
