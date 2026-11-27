import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Slice } from '../logic/analytics';
import { colors } from '../theme';

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = { x: cx + r * Math.cos(start), y: cy + r * Math.sin(start) };
  const e = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** Donut chart with a legend; small slices beyond `maxSlices` are grouped as "Others". */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  format,
  maxSlices = 6,
}: {
  data: Slice[];
  centerLabel: string;
  centerValue: string;
  format: (n: number) => string;
  maxSlices?: number;
}) {
  const size = 170;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.slice(0, maxSlices);
  const rest = data.slice(maxSlices).reduce((s, d) => s + d.value, 0);
  const slices = rest > 0 ? [...shown, { key: '_rest', label: 'Others', value: rest, color: '#B0BEC5' }] : shown;

  let angle = -Math.PI / 2;
  const gap = slices.length > 1 ? 0.02 : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            slices.map((s) => {
              const sweep = (s.value / total) * Math.PI * 2;
              const start = angle + gap / 2;
              const end = angle + Math.max(sweep - gap / 2, start - angle + 0.001);
              angle += sweep;
              if (sweep >= Math.PI * 2 - 0.0001) {
                return <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none" />;
              }
              return <Path key={s.key} d={arcPath(size / 2, size / 2, r, start, end)} stroke={s.color} strokeWidth={stroke} fill="none" />;
            })}
        </Svg>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>{centerLabel}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{centerValue}</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {slices.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.text }} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </Text>
          </View>
        ))}
        {slices.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>No spending yet</Text> : null}
        {total > 0 ? <Text style={{ fontSize: 11, color: colors.muted }}>Total {format(total)}</Text> : null}
      </View>
    </View>
  );
}

/** Grouped bar chart (e.g. income vs expense per month). */
export function BarChart({
  labels,
  series,
  width,
  height = 180,
  format,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  width: number;
  height?: number;
  format: (n: number) => string;
}) {
  const padTop = 16;
  const padBottom = 22;
  const padLeft = 44;
  const chartH = height - padTop - padBottom;
  const chartW = width - padLeft;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const groupW = chartW / Math.max(1, labels.length);
  const barW = Math.min(18, (groupW - 10) / series.length);
  const ticks = [0, 0.5, 1];
  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((t) => {
          const y = padTop + chartH * (1 - t);
          return (
            <G key={t}>
              <Line x1={padLeft} x2={width} y1={y} y2={y} stroke={colors.border} strokeDasharray="3 3" />
              <SvgText x={padLeft - 6} y={y + 4} fontSize={10} fill={colors.muted} textAnchor="end">
                {format(max * t)}
              </SvgText>
            </G>
          );
        })}
        {labels.map((label, i) => {
          const gx = padLeft + i * groupW + (groupW - barW * series.length) / 2;
          return (
            <G key={label + i}>
              {series.map((s, si) => {
                const h = (s.values[i] / max) * chartH;
                return (
                  <Rect
                    key={s.name}
                    x={gx + si * barW}
                    y={padTop + chartH - h}
                    width={barW - 2}
                    height={Math.max(0, h)}
                    rx={3}
                    fill={s.color}
                  />
                );
              })}
              <SvgText x={padLeft + i * groupW + groupW / 2} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
                {label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
        {series.map((s) => (
          <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars – good for "top merchants" and "spend by member". */
export function HBars({ rows, format }: { rows: { label: string; value: number; sub?: string; color?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>
              {r.label}
              {r.sub ? <Text style={{ color: colors.muted }}>  {r.sub}</Text> : null}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{format(r.value)}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
            <View style={{ height: 6, borderRadius: 3, width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? colors.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Circular score gauge for the financial health score. */
export function ScoreRing({ score, size = 96, label }: { score: number; size?: number; label: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? colors.success : score >= 60 ? colors.primary : score >= 40 ? colors.warning : colors.danger;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color }}>{score}</Text>
        <Text style={{ fontSize: 10, color: colors.muted }}>{label}</Text>
      </View>
    </View>
  );
}

/** Line with a soft filled area, e.g. net worth growth. `light` draws white for coloured backgrounds. */
export function AreaChart({ values, labels, width, height = 90, color = colors.primary, light }: { values: number[]; labels?: string[]; width: number; height?: number; color?: string; light?: boolean }) {
  if (values.length < 2) return null;
  const stroke = light ? '#fff' : color;
  const pad = 6;
  const labelH = labels ? 16 : 0;
  const h = height - labelH;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = values.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
  const area = `${line} L ${x(values.length - 1)} ${h} L ${x(0)} ${h} Z`;
  return (
    <Svg width={width} height={height} accessibilityLabel="Growth chart">
      <Path d={area} fill={stroke} opacity={light ? 0.18 : 0.12} />
      <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.5} fill={stroke} />
      ))}
      {labels?.map((l, i) => (
        <SvgText key={l + i} x={i === 0 ? 0 : i === labels.length - 1 ? width : x(i)} y={height - 3} fontSize={10} fill={light ? '#ffffffcc' : colors.muted} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}
