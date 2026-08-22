import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { LoginForm } from '../../src/components/organisms';
import { AuthTemplate } from '../../src/components/templates';
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../../src/auth';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { colors, themedStyles, typography } from '../../src/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  return (
    <AuthTemplate
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      footer={
        <Link href="/register" replace asChild>
          <Text style={styles.link}>
            {t('auth.noAccount')}{' '}
            <Text style={styles.linkStrong}>{t('auth.createOne')}</Text>
          </Text>
        </Link>
      }
    >
      <LoginForm
        demo={{ email: DEMO_EMAIL, password: DEMO_PASSWORD }}
        onSubmit={async (email, password) => {
          await signIn(email, password);
          // The gate redirects on status change; this keeps the auth stack
          // from lingering underneath if the user backs out quickly.
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
