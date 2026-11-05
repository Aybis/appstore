import type { LucideIcon } from 'lucide-react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Switch, Text, View } from 'react-native';

import { PressableScale } from '../../motion';
import { colors, spacing, themedStyles, typography } from '../../theme/tokens';

type Props = {
  icon: LucideIcon;
  label: string;
  /** Right-aligned current value, e.g. "English". */
  value?: string;
  /** Makes the row tappable and shows a chevron. */
  onPress?: () => void;
  /** With `onPress`: the chevron points down and the content below is shown. */
  expanded?: boolean;
  /** Renders a switch instead of a chevron. */
  toggle?: { value: boolean; onValueChange: (next: boolean) => void };
  /** Shown under the row while `expanded`, inside the same card. */
  children?: ReactNode;
};

/**
 * One line of a SettingsGroup: an icon in a soft circle, the label, then
 * either a value, a chevron or a switch. Pass `children` and `expanded` to
 * open an inline editor beneath the row instead of navigating away.
 */
export const SettingsRow = ({
  icon: Icon,
  label,
  value,
  onPress,
  expanded = false,
  toggle,
  children,
}: Props) => {
  const body = (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <Icon size={18} color={colors.text} strokeWidth={1.75} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: colors.surfaceStrong, true: colors.highlight }}
          thumbColor="#FFFFFF"
          accessibilityLabel={label}
        />
      ) : onPress ? (
        expanded ? (
          <ChevronDown size={18} color={colors.textTertiary} />
        ) : (
          <ChevronRight size={18} color={colors.textTertiary} />
        )
      ) : null}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          scaleTo="control"
          haptic="select"
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}, ${value}` : label}
          accessibilityState={{ expanded }}
        >
          {body}
        </PressableScale>
      ) : (
        body
      )}
      {expanded && children ? <View style={styles.panel}>{children}</View> : null}
    </View>
  );
};

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  value: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  panel: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
}));
