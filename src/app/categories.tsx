import { ask } from '../components/Dialog';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, HeaderAdd, Icon, ListItem, Screen, SectionTitle, styles } from '../components/ui';
import type { CategoryKind } from '../logic/types';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const KINDS: { key: CategoryKind; label: string; hint: string }[] = [
  { key: 'need', label: 'Need', hint: 'Essentials: rent, groceries, fees' },
  { key: 'want', label: 'Want', hint: 'Nice to have: dining, shopping, hobbies' },
  { key: 'saving', label: 'Saving', hint: 'Investments, deposits' },
  { key: 'income', label: 'Income', hint: 'Money coming in' },
];

const ICONS = [
  'pricetag-outline', 'paw-outline', 'barbell-outline', 'bicycle-outline', 'book-outline', 'construct-outline', 'flower-outline',
  'game-controller-outline', 'heart-outline', 'leaf-outline', 'musical-notes-outline', 'people-outline', 'restaurant-outline',
  'shirt-outline', 'sparkles-outline', 'hammer-outline', 'water-outline', 'wine-outline', 'boat-outline', 'bus-outline',
  'cafe-outline', 'color-palette-outline', 'globe-outline', 'laptop-outline', 'cash-outline', 'gift-outline',
];
const COLORS = ['#2E7D32', '#1565C0', '#6A1B9A', '#C62828', '#EF6C00', '#00838F', '#AD1457', '#5D4037', '#F9A825', '#455A64'];

export default function Categories() {
  const params = useLocalSearchParams<{ kind?: CategoryKind }>();
  const { categories, addCategory, updateCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>(params.kind ?? 'want');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [editing, setEditing] = useState<string | null>(null);
  // Opened from Add transaction with ?kind= → go straight to the new-category form.
  const [adding, setAdding] = useState(!!params.kind);
  const formOpen = adding || !!editing;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add a category" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);

  const startEdit = (id: string) => {
    const c = categories.find((x) => x.id === id)!;
    setEditing(id);
    setName(c.name);
    setKind(c.kind);
    setIcon(c.icon);
    setColor(c.color);
  };
  const reset = () => {
    setEditing(null);
    setAdding(false);
    setName('');
  };

  const save = () => {
    if (!name.trim()) return ask('Give the category a name');
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase() && c.id !== editing)) return ask('A category with this name already exists');
    if (editing) updateCategory(editing, { name: name.trim(), kind, icon, color });
    else addCategory({ name: name.trim(), kind, icon, color });
    reset();
    if (params.kind && !editing) router.back();
  };

  const remove = (id: string, label: string) =>
    ask(`Delete “${label}”?`, 'Its transactions move to “Other”.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCategory(id); reset(); } },
    ]);

  const custom = categories.filter((c) => c.custom);

  if (formOpen) {
    return (
      <Screen>
        <Card>
          <Text style={styles.itemTitle}>{editing ? 'Edit category' : 'New category'}</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Pet care, Maid salary, Gym" />
          <Text style={styles.label}>Type</Text>
          <ChipRow>
            {KINDS.map((k) => (
              <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
            ))}
          </ChipRow>
          <Text style={styles.hint}>{KINDS.find((k) => k.key === kind)?.hint}. Used for the 50-30-20 check.</Text>
          <Text style={styles.label}>Icon</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ICONS.map((i) => (
              <Pressable key={i} onPress={() => setIcon(i)} style={{ padding: 8, borderRadius: 10, backgroundColor: icon === i ? `${color}22` : colors.bg, borderWidth: 1, borderColor: icon === i ? color : 'transparent' }}>
                <Icon name={i} color={icon === i ? color : colors.muted} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Colour</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 3, borderColor: color === c ? colors.text : 'transparent' }} />
            ))}
          </View>
          <Button title={editing ? 'Save changes' : 'Add category'} icon="checkmark" onPress={save} />
          {editing && categories.find((c) => c.id === editing)?.custom ? (
            <Button title="Delete this category" variant="danger" icon="trash-outline" onPress={() => remove(editing, name)} />
          ) : null}
          <Button title="Cancel" variant="secondary" onPress={reset} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title="Add a category" icon="add" onPress={() => setAdding(true)} />


      <SectionTitle title={`Your categories · ${custom.length}`} />
      <Card>
        {custom.length === 0 ? <Text style={styles.itemSub}>Categories you add appear here. You can edit or delete them any time.</Text> : null}
        {custom.map((c) => (
          <ListItem key={c.id} icon={c.icon} iconColor={c.color} title={c.name} subtitle={KINDS.find((k) => k.key === c.kind)?.label} right="Edit" onPress={() => startEdit(c.id)} />
        ))}
      </Card>

      <SectionTitle title="Built-in categories" />
      <Card>
        {categories.filter((c) => !c.custom).map((c) => (
          <ListItem key={c.id} icon={c.icon} iconColor={c.color} title={c.name} subtitle={KINDS.find((k) => k.key === c.kind)?.label} />
        ))}
      </Card>
    </Screen>
  );
}
