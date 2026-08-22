import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../constants/theme';
import { FadeIn } from '../../motion';
import { Badge, Caption, IconPlaceholder, Title } from '../atoms';

type Props = {
  /** Null until authentication exists — renders the signed-out state. */
  name?: string | null;
  subtitle?: string;
  /** Org role, e.g. "Admin" or "Engineering" — renders as a small badge. */
  role?: string;
};

/**
 * Account block at the top of Profile: a gradient-initial avatar, name, an
 * org/email line, and an optional role badge, together on their own surface
 * panel. There is no auth yet on some builds, so the default state says so
 * plainly rather than faking a user.
 */
export const ProfileIdentity = ({ name = null, subtitle, role }: Props) => (
  <FadeIn>
    <View style={styles.panel}>
      <IconPlaceholder seed={name ?? 'guest'} name={name ?? 'Guest'} size={72} />
      <View style={styles.text}>
        <Title>{name ?? 'Not signed in'}</Title>
        <Caption>
          {subtitle ??
            'Sign-in with your company account arrives with the auth milestone.'}
        </Caption>
        {role ? (
          <View style={styles.role}>
            <Badge label={role} />
          </View>
        ) : null}
      </View>
    </View>
  </FadeIn>
);

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  role: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
});
