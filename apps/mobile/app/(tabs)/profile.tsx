import Constants from 'expo-constants';
import { StyleSheet } from 'react-native';

import { Button, Caption, Paragraph } from '../../src/components/atoms';
import { InfoTable, Notice, Section } from '../../src/components/molecules';
import { ProfileIdentity } from '../../src/components/organisms';
import { ScrollTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/auth';
import { config } from '../../src/api';
import { formatDate } from '../../src/utils/format';
import { spacing } from '../../src/constants/theme';

/** Profile — the signed-in account plus which backend the app is talking to. */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollTemplate>
      <ProfileIdentity name={user?.name ?? null} subtitle={user?.email} />

      <Paragraph>
        MAYA is a private catalog for company-built Android and iOS apps.
        Everything is served from internal infrastructure — nothing here is
        published to a public store.
      </Paragraph>

      <Section title="Account">
        <InfoTable
          rows={[
            { label: 'Name', value: user?.name ?? '—' },
            { label: 'Email', value: user?.email ?? '—' },
            {
              label: 'Member since',
              value: user ? formatDate(user.createdAt) : '—',
            },
          ]}
        />
      </Section>

      <Section title="Environment">
        <InfoTable
          rows={[
            {
              label: 'App version',
              value: Constants.expoConfig?.version ?? '1.0.0',
            },
            {
              label: 'Data source',
              value: config.useMockData ? 'Mock provider' : 'NestJS API',
            },
            { label: 'API base URL', value: config.apiBaseUrl },
            { label: 'API prefix', value: config.apiPrefix },
          ]}
        />
      </Section>

      {config.useMockData && (
        <Notice
          title="Mock data is active"
          body="The catalog is served by MockAppProvider and accounts live in local storage. Set expo.extra.useMockData to false in app.json to point the app at the real API."
        />
      )}

      <Button
        label="Sign out"
        variant="ghost"
        onPress={() => void signOut()}
      />

      <Caption style={styles.footer}>
        Need an app published? Contact your platform team.
      </Caption>
    </ScrollTemplate>
  );
}

const styles = StyleSheet.create({
  footer: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
