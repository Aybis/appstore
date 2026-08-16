import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { LoginForm } from '../../src/components/organisms';
import { AuthTemplate } from '../../src/components/templates';
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../../src/auth';
import { colors, typography } from '../../src/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();

  return (
    <AuthTemplate
      title="Sign in to MAYA"
      subtitle="Use your company account to reach the internal catalog."
      footer={
        <Link href="/register" replace asChild>
          <Text style={styles.link}>
            No account yet? <Text style={styles.linkStrong}>Create one</Text>
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

const styles = StyleSheet.create({
  link: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  linkStrong: {
    color: colors.accent,
    fontWeight: '600',
  },
});
