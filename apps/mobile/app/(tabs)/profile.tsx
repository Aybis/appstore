import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, Paragraph } from '../../src/components/atoms';
import { FormField, InfoTable, Section, SegmentedControl } from '../../src/components/molecules';
import { ProfileIdentity } from '../../src/components/organisms';
import { ScrollTemplate } from '../../src/components/templates';
import {
  changePassword,
  fetchProfile,
  pickAvatar,
  removeAvatar,
  updateName,
  uploadAvatar,
} from '../../src/services/account';
import { config } from '../../src/services/api';
import { useAuth } from '../../src/services/auth';
import { formatDate } from '../../src/utils/format';
import { useTheme, type ThemePreference } from '../../src/theme';
import { useT, useI18n, type Language } from '../../src/i18n';
import { TAB_BAR_HEIGHT } from '../../src/theme/layout';
import { spacing } from '../../src/theme/tokens';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Profile — the signed-in account, editing it, appearance and language. */
export default function ProfileScreen() {
  const { user, signOut, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();
  const { language, setLanguage } = useI18n();
  const t = useT();

  // Editing needs the API; the mock provider keeps accounts on the device.
  const editable = !config.useMockData && Boolean(user);

  /*
   * Re-read on focus: sign-in only returns the name, and the photo or the
   * name may have changed on the web console since.
   */
  useFocusEffect(
    useCallback(() => {
      if (!editable) return;
      fetchProfile().then(updateUser, () => undefined);
    }, [editable, updateUser]),
  );

  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [photoBusy, setPhotoBusy] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setNameError(t('profile.nameRequired'));
    setNameError(null);
    setNameState('saving');
    try {
      await updateUser(await updateName(trimmed));
      setNameState('saved');
    } catch (error) {
      setNameError(message(error));
      setNameState('idle');
    }
  };

  const changePhoto = async () => {
    const uri = await pickAvatar();
    if (!uri) return;
    setPhotoBusy(true);
    try {
      await updateUser(await uploadAvatar(uri));
    } catch (error) {
      Alert.alert(t('profile.changePhoto'), message(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setPhotoBusy(true);
    try {
      await updateUser(await removeAvatar());
    } catch (error) {
      Alert.alert(t('profile.removePhoto'), message(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePassword = async () => {
    if (next !== confirm) return setPasswordError(t('profile.passwordMismatch'));
    setPasswordError(null);
    setPasswordBusy(true);
    try {
      await changePassword(current, next);
      // Every session just ended on the server, this one included.
      Alert.alert(t('profile.passwordChanged'), t('profile.passwordChangedBody'));
      await signOut();
    } catch (error) {
      setPasswordError(message(error));
      setPasswordBusy(false);
    }
  };

  const themeOptions: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('theme.system') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];

  const languageOptions: readonly { value: Language; label: string }[] = [
    { value: 'en', label: t('language.en') },
    { value: 'id', label: t('language.id') },
  ];

  return (
    <ScrollTemplate bottomInset={insets.bottom + TAB_BAR_HEIGHT}>
      <ProfileIdentity name={user?.name ?? null} avatarUrl={user?.avatarUrl} subtitle={user?.email} />

      <Paragraph>{t('profile.intro')}</Paragraph>

      {editable && (
        <Section title={t('profile.edit')}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Button
                label={t('profile.changePhoto')}
                variant="ghost"
                loading={photoBusy}
                onPress={() => void changePhoto()}
              />
            </View>
            {user?.avatarUrl ? (
              <View style={styles.grow}>
                <Button
                  label={t('profile.removePhoto')}
                  variant="ghost"
                  disabled={photoBusy}
                  onPress={() => void deletePhoto()}
                />
              </View>
            ) : null}
          </View>

          <FormField
            label={t('profile.name')}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameState('idle');
            }}
            autoComplete="name"
            maxLength={120}
            error={nameError}
          />
          <Button
            label={nameState === 'saved' ? t('profile.saved') : t('profile.save')}
            loading={nameState === 'saving'}
            disabled={name.trim() === user?.name}
            onPress={() => void saveName()}
          />
        </Section>
      )}

      {editable && (
        <Section title={t('profile.password')}>
          <FormField
            label={t('profile.currentPassword')}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
          />
          <FormField
            label={t('profile.newPassword')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoComplete="new-password"
          />
          <FormField
            label={t('profile.confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            error={passwordError}
          />
          <Caption>{t('profile.passwordHint')}</Caption>
          <Button
            label={t('profile.changePassword')}
            loading={passwordBusy}
            disabled={!current || !next || !confirm}
            onPress={() => void savePassword()}
          />
        </Section>
      )}

      <Section title={t('profile.appearance')}>
        <SegmentedControl
          options={themeOptions}
          value={preference}
          onChange={setPreference}
          accessibilityLabel={t('profile.appearance')}
        />
      </Section>

      <Section title={t('profile.language')}>
        <SegmentedControl
          options={languageOptions}
          value={language}
          onChange={setLanguage}
          accessibilityLabel={t('profile.language')}
        />
      </Section>

      <Section title={t('profile.account')}>
        <InfoTable
          rows={[
            { label: t('profile.email'), value: user?.email ?? '—' },
            {
              label: t('profile.memberSince'),
              value: user ? formatDate(user.createdAt) : '—',
            },
          ]}
        />
      </Section>

      {/*
        * Shown only when the organization has actually published them. A link
        * to a page that does not exist is worse than no link — see
        * config.termsUrl for why these are configured rather than shipped.
        */}
      <Section title={t('profile.legal')}>
        {config.termsUrl || config.privacyUrl ? (
          <>
            {config.termsUrl ? (
              <Button
                label={t('profile.terms')}
                variant="ghost"
                onPress={() => void Linking.openURL(config.termsUrl)}
              />
            ) : null}
            {config.privacyUrl ? (
              <Button
                label={t('profile.privacy')}
                variant="ghost"
                onPress={() => void Linking.openURL(config.privacyUrl)}
              />
            ) : null}
          </>
        ) : (
          <Paragraph>{t('profile.legalUnset')}</Paragraph>
        )}
      </Section>

      <Button
        label={t('profile.signOut')}
        variant="dangerSoft"
        onPress={() => void signOut()}
      />

      <Caption style={styles.footer}>
        {t('profile.footer')}
        {'\n'}
        {t('profile.version', { version: Constants.expoConfig?.version ?? '' })}
      </Caption>
    </ScrollTemplate>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
