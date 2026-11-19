import { router } from 'expo-router';
import { Text } from 'react-native';
import { ACCOUNT_GROUPS, ACCOUNT_TYPE_ICON, isLiability, type NetWorth } from '../logic/balances';
import type { PersonBalance } from '../logic/money2';
import type { Account } from '../logic/types';
import { colors } from '../theme';
import { Card, ListItem, Row, styles } from './ui';

/** Every account's own balance, grouped (savings, investments & gold, credit cards, loans…), plus money lent and borrowed. */
export function BalanceList({ accounts, balances, nw, people, money }: { accounts: Account[]; balances: Record<string, number>; nw: NetWorth; people: PersonBalance[]; money: (n: number) => string }) {
  const active = accounts.filter((a) => !a.archived && a.type !== 'people');
  const owed = people.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const owe = -people.filter((p) => p.balance < 0).reduce((s, p) => s + p.balance, 0);
  return (
    <>
      {ACCOUNT_GROUPS.map((group) => {
        const list = active.filter((a) => group.types.includes(a.type));
        const lendBorrow = group.key === 'other' && (owed > 0 || owe > 0);
        if (!list.length && !lendBorrow) return null;
        return (
          <Card key={group.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.label}>{group.label}</Text>
              <Text style={[styles.label, { color: nw.byGroup[group.key] < 0 ? colors.danger : colors.text }]}>{money(nw.byGroup[group.key])}</Text>
            </Row>
            {list.map((a) => {
              const linked = a.type === 'debit_card' && a.linkedBankId ? accounts.find((b) => b.id === a.linkedBankId) : undefined;
              const bal = balances[a.id] ?? 0;
              const owing = Math.max(0, -bal);
              const sub =
                a.type === 'credit_card'
                  ? a.creditLimit
                    ? `${money(Math.max(0, a.creditLimit - owing))} available of ${money(a.creditLimit)}`
                    : a.billingDay
                      ? `Bill day ${a.billingDay} · due day ${a.dueDay}`
                      : 'Tap to add billing date'
                  : linked
                    ? `Uses ${linked.name}`
                    : a.type === 'loan' && a.interestRate
                      ? `${a.interestRate}% interest`
                      : a.type === 'gold' && a.goldGrams
                        ? `${a.goldGrams} g`
                        : undefined;
              return (
                <ListItem
                  key={a.id}
                  icon={ACCOUNT_TYPE_ICON[a.type]}
                  iconColor={isLiability(a.type) ? colors.danger : colors.primary}
                  title={a.name}
                  subtitle={sub}
                  right={linked ? '' : isLiability(a.type) ? money(owing) : money(bal)}
                  rightSub={isLiability(a.type) && !linked ? 'outstanding' : undefined}
                  rightColor={isLiability(a.type) || bal < 0 ? colors.danger : undefined}
                  onPress={() => router.push(`/account-form?id=${a.id}`)}
                />
              );
            })}
            {lendBorrow ? (
              <>
                {owed > 0 ? <ListItem icon="arrow-up-circle-outline" iconColor={colors.success} title="Others owe you" subtitle="Money you lent" right={`+${money(owed)}`} rightColor={colors.success} onPress={() => router.push('/people')} /> : null}
                {owe > 0 ? <ListItem icon="arrow-down-circle-outline" iconColor={colors.danger} title="You owe others" subtitle="Money you borrowed" right={`−${money(owe)}`} rightColor={colors.danger} onPress={() => router.push('/people')} /> : null}
              </>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}
