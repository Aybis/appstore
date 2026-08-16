import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage } from '../../auth';
import { spacing } from '../../constants/theme';
import { Button, Caption } from '../atoms';
import { FormField } from '../molecules';

type Props = {
  /** Rejects on failure — the message is rendered inline. */
  onSubmit: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
};

export const RegisterForm = ({ onSubmit }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name, email, password });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <FormField
        label="FULL NAME"
        value={name}
        onChangeText={setName}
        placeholder="Ada Lovelace"
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
      />

      <FormField
        label="WORK EMAIL"
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
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={error}
      />

      <Button
        label="Create account"
        onPress={() => void submit()}
        loading={busy}
        disabled={!name || !email || !password}
      />

      <Caption style={styles.note}>
        Accounts are stored on this device only until the API ships.
      </Caption>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  note: {
    textAlign: 'center',
  },
});
