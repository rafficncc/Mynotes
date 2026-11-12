import { ask } from '../components/Dialog';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Empty, Field, Row, Screen, SectionTitle, styles } from '../components/ui';
import { formatShortDate, parseDate, toISODate } from '../logic/dates';
import { compareItems, normalize } from '../logic/priceBook';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Prices() {
  const data = useAppData();
  const addPrice = useStore((s) => s.addPrice);
  const deletePrice = useStore((s) => s.deletePrice);
  const { money } = useMoney();
  const [item, setItem] = useState('');
  const [shop, setShop] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');

  const comparisons = useMemo(() => compareItems(data.prices, new Date()), [data.prices]);

  const add = () => {
    const p = parseFloat(price);
    if (!item.trim() || !shop.trim() || !p) return ask('Enter item, shop and price');
    addPrice({ item: item.trim(), shop: shop.trim(), price: p, unit: unit.trim() || undefined, date: toISODate(new Date()) });
    setPrice('');
    setShop('');
  };

  const removeItem = (name: string) =>
    ask(`Remove “${name}” from price book?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => data.prices.filter((p) => normalize(p.item) === normalize(name)).forEach((p) => deletePrice(p.id)),
      },
    ]);

  return (
    <Screen>
      <Card>
        <Text style={styles.itemTitle}>Note a price you saw</Text>
        <Text style={styles.hint}>
          Saw milk cheaper at another shop? Note it here (or add item + qty while logging an expense). FamilyFin then tells you where to buy each item.
        </Text>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 2 }}><Field label="Item" value={item} onChangeText={setItem} placeholder="Milk" /></View>
          <View style={{ flex: 1 }}><Field label="Unit" value={unit} onChangeText={setUnit} placeholder="litre" /></View>
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 2 }}><Field label="Shop" value={shop} onChangeText={setShop} placeholder="Kirana Corner" /></View>
          <View style={{ flex: 1 }}><Field label="Price / unit" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="54" /></View>
        </Row>
        <Button title="Save price" icon="add" onPress={add} />
      </Card>

      <SectionTitle title="Best shop for each item" />
      {comparisons.length === 0 ? (
        <Empty icon="storefront-outline" title="No prices yet" text="Add prices from two or more shops to start comparing." />
      ) : null}
      {comparisons.map((c) => (
        <Card key={c.item}>
          <Text style={styles.sectionTitle}>{c.item}</Text>
          {c.shops.map((s, i) => (
            <Row key={s.shop} style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.insightText, i === 0 && c.shops.length > 1 && { color: colors.success, fontWeight: '700' }]}>
                {i === 0 && c.shops.length > 1 ? '★ ' : ''}
                {s.shop}
                {s.shop === c.usual.shop && c.shops.length > 1 ? ' (usual)' : ''}
              </Text>
              <Text style={styles.insightText}>
                {money(s.price)}{c.unit ? `/${c.unit}` : ''} · {formatShortDate(parseDate(s.date))}
              </Text>
            </Row>
          ))}
          {c.savingPerUnit > 0 && c.cheapest.shop !== c.usual.shop ? (
            <Text style={[styles.saveTag, { color: colors.success }]}>
              Switch from {c.usual.shop} to {c.cheapest.shop}: save {money(c.savingPerUnit)} per {c.unit ?? 'unit'}
            </Text>
          ) : null}
          <Text style={[styles.link, { fontSize: 12 }]} onPress={() => removeItem(c.item)}>Remove item</Text>
        </Card>
      ))}
    </Screen>
  );
}
