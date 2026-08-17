import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { RegisterForm } from '../../src/components/organisms';
import { AuthTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/auth';
import { config } from '../../src/api/config';
import { colors, typography } from '../../src/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  return (
    <AuthTemplate
      title="Create your account"
      subtitle="Registration is local dummy data until the API ships."
      footer={
        <Link href="/login" replace asChild>
          <Text style={styles.link}>
            Already have an account?{' '}
            <Text style={styles.linkStrong}>Sign in</Text>
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
