import { Text, View } from 'react-native';
import { t } from '../i18n';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { Button, Card, Icon, Row, styles } from './ui';

const NONE: string[] = [];

/** A short "how this screen works" card, shown until the user taps Got it. */
export function TipCard({ id, title, points }: { id: string; title: string; points: string[] }) {
  // Default outside the selector: a new [] on every read would loop forever.
  const seen = useStore((s) => s.settings.seenTips) ?? NONE;
  const updateSettings = useStore((s) => s.updateSettings);
  if (seen.includes(id)) return null;
  return (
    <Card style={{ backgroundColor: colors.infoSoft }}>
      <Row>
        <Icon name="school-outline" color={colors.info} />
        <Text style={[styles.itemTitle, { color: colors.info, flex: 1 }]}>{title}</Text>
      </Row>
      <View style={{ gap: 4 }}>
        {points.map((p, i) => (
          <Text key={i} style={styles.insightText}>
            {i + 1}. {p}
          </Text>
        ))}
      </View>
      <Button title={t('Got it')} variant="secondary" onPress={() => updateSettings({ seenTips: [...seen, id] })} />
    </Card>
  );
}
