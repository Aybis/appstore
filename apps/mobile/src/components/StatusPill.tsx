import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { accessLabel } from '../utils/format';
import type { AccessStatus } from '../types';

type Props = { status: AccessStatus };

/** Makes app access state explicit in the UI (BRD FR-4.4). */
export const StatusPill = ({ status }: Props) => (
  <View style={[styles.pill, tone[status]]}>
    <Text style={[styles.label, toneText[status]]}>{accessLabel[status]}</Text>
  </View>
);

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});

const tone = StyleSheet.create({
  available: { backgroundColor: colors.accentSoft },
  restricted: { backgroundColor: colors.dangerSoft },
  unsupported: { backgroundColor: colors.surfaceMuted },
});

const toneText = StyleSheet.create({
  available: { color: colors.accent },
  restricted: { color: colors.danger },
  unsupported: { color: colors.textSecondary },
});
