import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage } from '../../auth';
import { useT } from '../../i18n';
import { config } from '../../api/config';
import { spacing } from '../../constants/theme';
import { FadeIn, haptics } from '../../motion';
import { Button } from '../atoms';
import { FormField, Notice } from '../molecules';

type Props = {
  /** Rejects on failure — the message is rendered inline. */
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Credentials for the seeded demo account, shown as a hint. */
  demo?: { email: string; password: string };
};

export const LoginForm = ({ onSubmit, demo }: Props) => {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email, password);
      haptics.success();
    } catch (caught) {
      setError(authErrorMessage(caught));
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      {demo && (
        <Notice
          title={t('auth.demo.title')}
          body={`${demo.email} · ${demo.password} — ${
            config.useMockData ? t('auth.demo.mock') : t('auth.demo.server')
          }`}
        />
      )}

      <FadeIn index={0}>
        <FormField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="next"
        />
      </FadeIn>

      <FadeIn index={1}>
        <FormField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={error}
        />
      </FadeIn>

      <FadeIn index={2}>
        <Button
          label={t('auth.signIn.action')}
          onPress={() => void submit()}
          loading={busy}
          disabled={!email || !password}
        />
      </FadeIn>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
});
