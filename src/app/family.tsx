import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { HBars } from '../components/charts';
import { Button, Card, Field, ListItem, Row, Screen, SectionTitle, styles } from '../components/ui';
import { inMonth, spendByMember } from '../logic/analytics';
import { toISODate } from '../logic/dates';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Family() {
  const data = useAppData();
  const { addMember, deleteMember } = useStore();
  const { money } = useMoney();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const key = toISODate(new Date()).slice(0, 7);
  const spend = useMemo(() => spendByMember(inMonth(data.transactions, key), data.members), [data.transactions, data.members, key]);

  return (
    <Screen>
      {spend.length > 0 ? (
        <Card>
          <Text style={styles.itemTitle}>This month by member</Text>
          <HBars rows={spend.map((s) => ({ label: s.name, value: s.total, color: colors.info }))} format={money} />
        </Card>
      ) : null}
      <Card>
        {data.members.map((m) => (
          <ListItem
            key={m.id}
            icon="person-circle-outline"
            title={m.name}
            subtitle={m.relation}
            onPress={() =>
              m.id === 'me'
                ? undefined
                : Alert.alert(`Remove ${m.name}?`, 'Past transactions keep their amounts but show as “Whole family”.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => deleteMember(m.id) },
                  ])
            }
          />
        ))}
      </Card>
      <SectionTitle title="Add member" />
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Name" value={name} onChangeText={setName} placeholder="Name" /></View>
          <View style={{ flex: 1 }}><Field label="Relation" value={relation} onChangeText={setRelation} placeholder="Spouse, Son, Mother…" /></View>
        </Row>
        <Button
          title="Add"
          icon="person-add-outline"
          onPress={() => {
            if (!name.trim()) return;
            addMember({ name: name.trim(), relation: relation.trim() || 'Family' });
            setName('');
            setRelation('');
          }}
        />
      </Card>
    </Screen>
  );
}
