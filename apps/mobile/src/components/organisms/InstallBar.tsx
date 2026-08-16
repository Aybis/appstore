import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { Button } from '../atoms';
import { formatBytes } from '../../utils/format';
import type { App } from '../../types';

type Props = {
  app: App;
  onInstall: () => void;
  installing: boolean;
  /** Safe-area bottom inset, passed down so the bar clears the home indicator. */
  bottomInset: number;
};

const installLabel = (app: App): string => {
  if (app.accessStatus === 'restricted') return 'Restricted';
  if (app.accessStatus === 'unsupported') return 'Unsupported device';
  return app.platform === 'ios' ? 'Install instructions' : 'Install';
};

const installNote = (app: App): string | null => {
  if (app.accessStatus === 'restricted') {
    return 'You do not have access to this app. Request it from IT.';
  }
  if (app.accessStatus === 'unsupported') {
    return `Not supported on this device — ${app.minOs} required.`;
  }
  return null;
};

/** Pinned install action at the bottom of the detail screen (BRD P4). */
export const InstallBar = ({
  app,
  onInstall,
  installing,
  bottomInset,
}: Props) => {
  const note = installNote(app);

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + spacing.md }]}>
      <Button
        label={installLabel(app)}
        hint={`v${app.version} · ${formatBytes(app.size)}`}
        onPress={onInstall}
        loading={installing}
        disabled={app.accessStatus !== 'available'}
      />
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  note: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
