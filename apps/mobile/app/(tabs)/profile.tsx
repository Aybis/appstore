import Constants from 'expo-constants';
import { Linking, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, Paragraph } from '../../src/components/atoms';
import {
  InfoTable,
  Notice,
  Section,
  SegmentedControl,
} from '../../src/components/molecules';
import { ProfileIdentity } from '../../src/components/organisms';
import { ScrollTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/auth';
import { config } from '../../src/api';
import { formatDate } from '../../src/utils/format';
import { useTheme, type ThemePreference } from '../../src/theme';
import { useT, useI18n, type Language } from '../../src/i18n';
import { TAB_BAR_HEIGHT } from '../../src/constants/layout';
import { spacing } from '../../src/constants/theme';

/** Profile — the signed-in account, appearance and language, and which backend
 * the app is talking to. */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();
  const { language, setLanguage } = useI18n();
  const t = useT();

  const themeOptions: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('theme.system') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];

  const languageOptions: readonly { value: Language; label: string }[] = [
    { value: 'en', label: t('language.en') },
    { value: 'id', label: t('language.id') },
  ];

  return (
    <ScrollTemplate bottomInset={insets.bottom + TAB_BAR_HEIGHT}>
      <ProfileIdentity name={user?.name ?? null} subtitle={user?.email} />

      <Paragraph>{t('profile.intro')}</Paragraph>

      <Section title={t('profile.appearance')}>
        <SegmentedControl
          options={themeOptions}
          value={preference}
          onChange={setPreference}
          accessibilityLabel={t('profile.appearance')}
        />
      </Section>

      <Section title={t('profile.language')}>
        <SegmentedControl
          options={languageOptions}
          value={language}
          onChange={setLanguage}
          accessibilityLabel={t('profile.language')}
        />
      </Section>

      <Section title={t('profile.account')}>
        <InfoTable
          rows={[
            { label: t('profile.name'), value: user?.name ?? '—' },
            { label: t('profile.email'), value: user?.email ?? '—' },
            {
              label: t('profile.memberSince'),
              value: user ? formatDate(user.createdAt) : '—',
            },
          ]}
        />
      </Section>

      <Section title={t('profile.environment')}>
        <InfoTable
          rows={[
            {
              label: t('profile.appVersion'),
              value: Constants.expoConfig?.version ?? '1.0.0',
            },
            {
              label: t('profile.dataSource'),
              value: config.useMockData ? 'Mock provider' : 'NestJS API',
            },
            { label: t('profile.apiBaseUrl'), value: config.apiBaseUrl },
            { label: t('profile.apiPrefix'), value: config.apiPrefix },
          ]}
        />
      </Section>

      {config.useMockData && (
        <Notice
          title={t('profile.mockTitle')}
          body="The catalog is served by MockAppProvider and accounts live in local storage. Set expo.extra.useMockData to false in app.json to point the app at the real API."
        />
      )}

      {/*
        * Shown only when the organization has actually published them. A link
        * to a page that does not exist is worse than no link — see
        * config.termsUrl for why these are configured rather than shipped.
        */}
      <Section title={t('profile.legal')}>
        {config.termsUrl || config.privacyUrl ? (
          <>
            {config.termsUrl ? (
              <Button
                label={t('profile.terms')}
                variant="ghost"
                onPress={() => void Linking.openURL(config.termsUrl)}
              />
            ) : null}
            {config.privacyUrl ? (
              <Button
                label={t('profile.privacy')}
                variant="ghost"
                onPress={() => void Linking.openURL(config.privacyUrl)}
              />
            ) : null}
          </>
        ) : (
          <Paragraph>{t('profile.legalUnset')}</Paragraph>
        )}
      </Section>

      <Button
        label={t('profile.signOut')}
        variant="dangerSoft"
        onPress={() => void signOut()}
      />

      <Caption style={styles.footer}>{t('profile.footer')}</Caption>
    </ScrollTemplate>
  );
}

const styles = StyleSheet.create({
  footer: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
