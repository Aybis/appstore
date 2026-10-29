import type { ReactElement } from 'react';
import { FlatList, View } from 'react-native';

import { spacing, themedStyles } from '../../theme/tokens';
import { SectionTitle } from '../atoms';

type Props<T> = {
  title: string;
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactElement;
};

/** A titled, edge-to-edge horizontal shelf — the unit the streaming home is made of. */
export const AppRail = <T,>({ title, data, keyExtractor, renderItem }: Props<T>) => {
  if (data.length === 0) return null;

  return (
    <View style={styles.rail}>
      <SectionTitle style={styles.title}>{title}</SectionTitle>
      <FlatList
        horizontal
        data={data as T[]}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => renderItem(item, index)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        initialNumToRender={4}
      />
    </View>
  );
};

const Gap = () => <View style={styles.gap} />;

const styles = themedStyles(() => ({
  rail: {
    gap: spacing.md,
  },
  title: {
    paddingHorizontal: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  gap: {
    width: spacing.md,
  },
}));
