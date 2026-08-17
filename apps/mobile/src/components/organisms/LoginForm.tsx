import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage } from '../../auth';
import { config } from '../../api/config';
import { spacing } from '../../constants/theme';
import { Button } from '../atoms';
import { FormField, Notice } from '../molecules';

type Props = {
  /** Rejects on failure — the message is rendered inline. */
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Credentials for the seeded demo account, shown as a hint. */
  demo?: { email: string; password: string };
};

export const LoginForm = ({ onSubmit, demo }: Props) => {
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
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      {demo && (
        <Notice
          title="Demo account"
          body={`${demo.email} · ${demo.password}${
            config.useMockData
              ? " — mock mode, so this account is local to this device."
              : " — seeded on the server for this organization."
          }`}
        />
      )}

      <FormField
        label="EMAIL"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
      />

      <FormField
        label="PASSWORD"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={error}
      />

      <Button
        label="Sign in"
        onPress={() => void submit()}
        loading={busy}
        disabled={!email || !password}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
});
