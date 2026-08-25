import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage } from '../../auth';
import { useT } from '../../i18n';
import { spacing } from '../../constants/theme';
import { FadeIn, haptics } from '../../motion';
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
  const t = useT();
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
      <FadeIn index={0}>
        <FormField
          label={t('auth.fullName')}
          value={name}
          onChangeText={setName}
          placeholder={t('auth.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
        />
      </FadeIn>

      <FadeIn index={1}>
        <FormField
          label={t('auth.workEmail')}
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

      <FadeIn index={2}>
        <FormField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordHint')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={error}
        />
      </FadeIn>

      <FadeIn index={3}>
        <Button
          label={t('auth.register.action')}
          onPress={() => void submit()}
          loading={busy}
          disabled={!name || !email || !password}
        />
      </FadeIn>

      <Caption style={styles.note}>
        {t('auth.register.localOnly')}
      </Caption>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  note: {
    textAlign: 'center',
  },
});
