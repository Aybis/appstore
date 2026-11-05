import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { RegisterForm } from '../../src/components/organisms';
import { UserPlus } from 'lucide-react-native';
import { AuthTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/services/auth';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { colors, themedStyles, typography } from '../../src/theme/tokens';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  return (
    <AuthTemplate
      icon={UserPlus}
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
