import { StyleSheet, View } from 'react-native';
import { spacing } from '../../constants/theme';
import { Caption, IconPlaceholder, Title } from '../atoms';

type Props = {
  /** Null until authentication exists — renders the signed-out state. */
  name?: string | null;
  subtitle?: string;
};

/**
 * Account block at the top of Profile. There is no auth yet (it lands with
 * Plan 03), so the default state says so plainly rather than faking a user.
 */
export const ProfileIdentity = ({ name = null, subtitle }: Props) => (
  <View style={styles.row}>
    <IconPlaceholder seed={name ?? 'guest'} name={name ?? 'Guest'} size={64} />
    <View style={styles.text}>
      <Title>{name ?? 'Not signed in'}</Title>
      <Caption>
        {subtitle ??
          'Sign-in with your company account arrives with the auth milestone.'}
      </Caption>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
});
