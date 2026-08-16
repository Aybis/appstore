import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { RegisterForm } from '../../src/components/organisms';
import { AuthTemplate } from '../../src/components/templates';
import { useAuth } from '../../src/auth';
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
