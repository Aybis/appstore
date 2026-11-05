import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import {
  Bell,
  CalendarDays,
  FileText,
  Globe,
  Info,
  Lock,
  Mail,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption } from '../../src/components/atoms';
import {
  FormField,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
} from '../../src/components/molecules';
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
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '../../src/services/notifications/notifications';
import { useAuth } from '../../src/services/auth';
import { track } from '../../src/services/telemetry';
import { confirmDialog, showMessage } from '../../src/services/dialog';
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

  // One inline editor open at a time, so the page stays a short menu.
  const [open, setOpen] = useState<'profile' | 'password' | 'appearance' | 'language' | null>(null);
  const toggleOpen = (key: NonNullable<typeof open>) => setOpen((now) => (now === key ? null : key));

  const [pushOn, setPushOn] = useState(false);
  useEffect(() => {
    const read = () => void getNotificationPermission().then((p) => setPushOn(p === 'granted'));
    read();
    // Coming back from system Settings is how the answer changes.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && read());
    return () => sub.remove();
  }, []);

  const changePush = async (next: boolean) => {
    if (next) {
      const result = await requestNotificationPermission();
      setPushOn(result === 'granted');
      // Denied for good: only the system Settings page can undo it.
      if (result === 'denied') void Linking.openSettings();
    } else {
      // An app cannot revoke its own permission; Settings is where that happens.
      void Linking.openSettings();
    }
  };

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
      void showMessage(t('profile.changePhoto'), message(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setPhotoBusy(true);
    try {
      await updateUser(await removeAvatar());
    } catch (error) {
      void showMessage(t('profile.removePhoto'), message(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Ending a session is not undone by tapping again, and the button sits where a
  // thumb lands by accident — so ask first.
  const confirmSignOut = async () => {
    const sure = await confirmDialog({
      title: t('profile.signOutTitle'),
      message: t('profile.signOutBody'),
      confirmLabel: t('profile.signOut'),
      cancelLabel: t('dialog.cancel'),
      tone: 'danger',
    });
    if (sure) await signOut();
  };

  const savePassword = async () => {
    if (next !== confirm) return setPasswordError(t('profile.passwordMismatch'));
    setPasswordError(null);
    setPasswordBusy(true);
    try {
      await changePassword(current, next);
      // Every session just ended on the server, this one included.
      void showMessage(t('profile.passwordChanged'), t('profile.passwordChangedBody'));
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

  const themeLabel = themeOptions.find((o) => o.value === preference)?.label;
  const languageLabel = languageOptions.find((o) => o.value === language)?.label;

  return (
    <ScrollTemplate bottomInset={insets.bottom + TAB_BAR_HEIGHT}>
      <ProfileIdentity name={user?.name ?? null} avatarUrl={user?.avatarUrl} subtitle={user?.email} />

      <SettingsGroup title={t('profile.account')}>
        {editable ? (
          <SettingsRow
            icon={UserRound}
            label={t('profile.edit')}
            onPress={() => toggleOpen('profile')}
            expanded={open === 'profile'}
          >
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
          </SettingsRow>
        ) : null}
        {editable ? (
          <SettingsRow
            icon={Lock}
            label={t('profile.password')}
            onPress={() => toggleOpen('password')}
            expanded={open === 'password'}
          >
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
          </SettingsRow>
        ) : null}
        <SettingsRow icon={Mail} label={t('profile.email')} value={user?.email ?? '—'} />
        <SettingsRow
          icon={CalendarDays}
          label={t('profile.memberSince')}
          value={user ? formatDate(user.createdAt) : '—'}
        />
      </SettingsGroup>

      <SettingsGroup title={t('profile.preferences')}>
        <SettingsRow
          icon={Bell}
          label={t('profile.notifications')}
          toggle={{ value: pushOn, onValueChange: (next) => void changePush(next) }}
        />
        <SettingsRow
          icon={Palette}
          label={t('profile.appearance')}
          value={themeLabel}
          onPress={() => toggleOpen('appearance')}
          expanded={open === 'appearance'}
        >
          <SegmentedControl
            options={themeOptions}
            value={preference}
            onChange={(next) => {
              track('setting_changed', { setting: 'theme', value: String(next) });
              setPreference(next);
            }}
            accessibilityLabel={t('profile.appearance')}
          />
        </SettingsRow>
        <SettingsRow
          icon={Globe}
          label={t('profile.language')}
          value={languageLabel}
          onPress={() => toggleOpen('language')}
          expanded={open === 'language'}
        >
          <SegmentedControl
            options={languageOptions}
            value={language}
            onChange={(next) => {
              track('setting_changed', { setting: 'language', value: String(next) });
              setLanguage(next);
            }}
            accessibilityLabel={t('profile.language')}
          />
        </SettingsRow>
      </SettingsGroup>

      {/*
        * Terms and privacy appear only when the organization has published
        * them — a link to a page that does not exist is worse than no link;
        * see config.termsUrl.
        */}
      <SettingsGroup title={t('profile.about')}>
        {config.termsUrl ? (
          <SettingsRow
            icon={FileText}
            label={t('profile.terms')}
            onPress={() => void Linking.openURL(config.termsUrl)}
          />
        ) : null}
        {config.privacyUrl ? (
          <SettingsRow
            icon={ShieldCheck}
            label={t('profile.privacy')}
            onPress={() => void Linking.openURL(config.privacyUrl)}
          />
        ) : null}
        <SettingsRow
          icon={Info}
          label={t('profile.version', { version: Constants.expoConfig?.version ?? '' })}
        />
      </SettingsGroup>

      <Button
        label={t('profile.signOut')}
        variant="dangerSoft"
        onPress={() => void confirmSignOut()}
      />

      <Caption style={styles.footer}>{t('profile.footer')}</Caption>
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
