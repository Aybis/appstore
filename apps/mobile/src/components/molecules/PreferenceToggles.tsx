import { Text, View } from 'react-native';

import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { PressableScale } from '../../motion';
import { MoonIcon, SunIcon } from '../atoms';

/**
 * Appearance and language, reachable before signing in.
 *
 * Both settings also live on the profile screen, which is behind the sign-in
 * wall — so someone who reads Indonesian, or who cannot comfortably read light
 * text on a dark ground, had to get through the one screen they could not read
 * before they could fix it. That is the wrong way round.
 *
 * Each control shows the state it is IN, not the state it would move to. A
 * language switcher reading "EN" while showing English is what people expect,
 * and having the theme control follow the same rule keeps the pair honest
 * rather than making one of them a prediction. The accessibility labels say
 * what a press will do, since an icon alone cannot.
 */
export const PreferenceToggles = () => {
  const { scheme, setPreference } = useTheme();
  const { language, setLanguage } = useI18n();

  const isDark = scheme === 'dark';

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={() => setPreference(isDark ? 'light' : 'dark')}
        accessibilityRole="button"
        /*
         * Sets an EXPLICIT preference rather than cycling through 'system'.
         * A three-state control needs three labels and a way to show which of
         * them is active; this is a toggle in a corner, and someone reaching
         * for it wants the other one now. 'System' stays available on profile.
         */
        accessibilityLabel={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      >
        <View style={styles.pill}>
          {isDark ? (
            <MoonIcon size={16} color={colors.textSecondary} />
          ) : (
            <SunIcon size={16} color={colors.textSecondary} />
          )}
        </View>
      </PressableScale>

      <PressableScale
        onPress={() => setLanguage(language === 'en' ? 'id' : 'en')}
        accessibilityRole="button"
        accessibilityLabel={
          language === 'en' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English'
        }
      >
        <View style={styles.pill}>
          <Text style={styles.code}>{language.toUpperCase()}</Text>
        </View>
      </PressableScale>
    </View>
  );
};

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  pill: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
}));
