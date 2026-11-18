import { useState } from 'react';
import { Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Empty, ListItem, Screen, styles } from '../components/ui';
import { formatDate } from '../logic/dates';
import { deletePhoto } from '../services/billPhotos';
import { useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';

export default function Trash() {
  const trash = useStore((s) => s.trash);
  const categories = useStore((s) => s.categories);
  const { restoreTransaction, purgeTrash } = useStore();
  const { money } = useMoney();
  const [openedAt] = useState(() => Date.now());

  return (
    <Screen>
      <Text style={styles.itemSub}>Deleted transactions stay here for 30 days, then are removed for good.</Text>
      {trash.length === 0 ? <Empty icon="trash-outline" title="Recycle bin is empty" /> : null}
      {trash.map((t) => {
        const days = Math.max(0, 30 - Math.floor((openedAt - new Date(t.deletedAt ?? 0).getTime()) / 86400000));
        return (
          <Card key={t.id} style={{ padding: 12 }}>
            <ListItem
              icon={categories.find((c) => c.id === t.categoryId)?.icon ?? 'swap-horizontal'}
              title={t.merchant || t.note || categories.find((c) => c.id === t.categoryId)?.name || 'Transaction'}
              subtitle={`${formatDate(t.date)} · removed for good in ${days} day${days === 1 ? '' : 's'}`}
              right={money(t.amount)}
            />
            <ChipRow>
              <Chip label="Restore" icon="arrow-undo-outline" selected onPress={() => restoreTransaction(t.id)} />
              <Chip
                label="Delete forever"
                icon="trash-outline"
                onPress={() =>
                  ask('Delete forever?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { deletePhoto(t.photoUri); purgeTrash(t.id); } },
                  ])
                }
              />
            </ChipRow>
          </Card>
        );
      })}
      {trash.length > 1 ? (
        <View>
          <Button
            title="Empty recycle bin"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              ask('Empty the recycle bin?', 'All items will be deleted for good.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Empty', style: 'destructive', onPress: () => trash.forEach((t) => { deletePhoto(t.photoUri); purgeTrash(t.id); }) },
              ])
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
