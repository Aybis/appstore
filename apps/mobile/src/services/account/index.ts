import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { config } from '../api/config';
import { authorizedFetch } from '../auth/AuthProvider';
import type { AuthUser } from '../storage/auth';

/** What GET /v1/me returns (@appstore/shared Profile). */
type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
};

/** The API's message for a refused request, or a generic one. */
const failure = async (response: Response, fallback: string): Promise<Error> => {
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return new Error(message || fallback);
};

const toUser = (profile: Profile): AuthUser => ({
  id: profile.id,
  name: profile.displayName,
  email: profile.email,
  createdAt: profile.createdAt,
  // The API answers with a path; an <Image> needs the full URL.
  avatarUrl: profile.avatarUrl ? `${config.apiBaseUrl}${profile.avatarUrl}` : undefined,
});

const json = async (response: Response, fallback: string): Promise<AuthUser> => {
  if (!response.ok) throw await failure(response, fallback);
  return toUser((await response.json()) as Profile);
};

export const fetchProfile = async (): Promise<AuthUser> =>
  json(await authorizedFetch('/me'), 'Could not load your profile');

export const updateName = async (displayName: string): Promise<AuthUser> =>
  json(
    await authorizedFetch('/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    }),
    'Could not save your name',
  );

/**
 * Lets the person pick a photo, crops it square and shrinks it to 512 px —
 * a phone photo is several MB and the API takes at most 1 MB. Null when they
 * cancel.
 */
export const pickAvatar = async (): Promise<string | null> => {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;

  const context = ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize({ width: 512, height: 512 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
};

export const uploadAvatar = async (uri: string): Promise<AuthUser> => {
  const form = new FormData();
  // React Native's FormData takes a file as { uri, name, type }.
  form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
  return json(await authorizedFetch('/me/avatar', { method: 'POST', body: form }), 'Could not upload the photo');
};

export const removeAvatar = async (): Promise<AuthUser> =>
  json(await authorizedFetch('/me/avatar', { method: 'DELETE' }), 'Could not remove the photo');

/** Ends every session on success, so the caller signs the person out. */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const response = await authorizedFetch('/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) throw await failure(response, 'Could not change the password');
};
