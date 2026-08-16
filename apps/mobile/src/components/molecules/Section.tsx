import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../constants/theme';
import { SectionTitle } from '../atoms';

type Props = {
  title: string;
  children: ReactNode;
};

/** Titled block used down the detail screen. */
export const Section = ({ title, children }: Props) => (
  <View style={styles.section}>
    <SectionTitle>{title}</SectionTitle>
    {children}
  </View>
);

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
});
