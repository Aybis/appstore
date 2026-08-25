import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { RegisterForm } from '../../src/components/organisms';
import { SignUp } from '../../src/components/illustrations';
import { AuthTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/auth';
import { config } from '../../src/api/config';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { colors, themedStyles, typography } from '../../src/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  return (
    <AuthTemplate
      illustration={SignUp}
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <Link href="/login" replace asChild>
          <Text style={styles.link}>
            {t('auth.haveAccount')}{' '}
            <Text style={styles.linkStrong}>{t('auth.signInInstead')}</Text>
          </Text>
        </Link>
      }
    >
      <RegisterForm
        onSubmit={async (input) => {
          // Self-signup against the API would create a NEW organization per
          // user (POST /v1/auth/signup takes orgSlug + orgName). An internal
          // store needs the opposite: joining an existing org, which is the
          // invite flow and does not exist yet. Local registration stays
          // available only while the app runs on mock data.
          if (!config.useMockData) {
            throw new Error(
              'Accounts for this organization are created by your platform team. Ask them for a login.',
            );
          }
          await register(input);
          router.replace('/');
        }}
      />
    </AuthTemplate>
  );
}

const styles = themedStyles(() => ({
  link: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  linkStrong: {
    color: colors.accent,
    fontWeight: '600',
  },
}));
