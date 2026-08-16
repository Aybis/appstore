import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

import { config } from '../src/api';
import { colors, radius, spacing, typography } from '../src/constants/theme';

/** About / settings screen — surfaces which backend the app is talking to. */
export default function AboutScreen() {
  const rows: { label: string; value: string }[] = [
    { label: 'App version', value: Constants.expoConfig?.version ?? '1.0.0' },
    { label: 'Data source', value: config.useMockData ? 'Mock provider' : 'NestJS API' },
    { label: 'API base URL', value: config.apiBaseUrl },
    { label: 'API prefix', value: config.apiPrefix },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Internal App Store</Text>
      <Text style={styles.body}>
        A private catalog for company-built Android and iOS apps. Everything is
        served from internal infrastructure over Tailscale — nothing here is
        published to a public store.
      </Text>

      <View style={styles.table}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {config.useMockData && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Mock data is active</Text>
          <Text style={styles.noticeBody}>
            The catalog is served by MockAppProvider. Set
            {' expo.extra.useMockData '}
            to false in app.json to point the app at the real API.
          </Text>
        </View>
      )}

      <Text style={styles.footer}>
        Need an app published? Contact your platform team.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  table: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  notice: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    gap: spacing.xs,
  },
  noticeTitle: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
  noticeBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  footer: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
