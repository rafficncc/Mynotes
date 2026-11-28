import { Pressable, Text, View } from 'react-native';
import { useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
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
  selected,
  onSelect,
  light,
  size = 170,
  legend = true,
}: {
  data: Slice[];
  centerLabel: string;
  centerValue: string;
  format: (n: number) => string;
  maxSlices?: number;
  /** Key of the highlighted slice ('_rest' = Others). */
  selected?: string | null;
  /** Makes slices and legend rows tappable; `keys` are the categories in that slice (several for Others). */
  onSelect?: (key: string, keys: string[]) => void;
  /** White text and track, for gradient cards. */
  light?: boolean;
  size?: number;
  /** false = caller draws its own legend. */
  legend?: boolean;
}) {
  const stroke = Math.round(size * 0.15);
  const r = (size - stroke) / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.slice(0, maxSlices);
  const rest = data.slice(maxSlices).reduce((s, d) => s + d.value, 0);
  const slices = rest > 0 ? [...shown, { key: '_rest', label: 'Others', value: rest, color: '#B0BEC5' }] : shown;
  const keysOf = (k: string) => (k === '_rest' ? data.slice(maxSlices).map((d) => d.key) : [k]);
  const pick = onSelect ? (k: string) => onSelect(k, keysOf(k)) : undefined;
  const dim = (k: string) => (selected && selected !== k ? 0.25 : 1);

  let angle = -Math.PI / 2;
  const gap = slices.length > 1 ? 0.02 : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={light ? '#ffffff1f' : colors.border} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            slices.map((s) => {
              const sweep = (s.value / total) * Math.PI * 2;
              const start = angle + gap / 2;
              const end = angle + Math.max(sweep - gap / 2, start - angle + 0.001);
              angle += sweep;
              if (sweep >= Math.PI * 2 - 0.0001) {
                return <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none" opacity={dim(s.key)} onPress={pick && (() => pick(s.key))} />;
              }
              return (
                <Path
                  key={s.key}
                  d={arcPath(size / 2, size / 2, r, start, end)}
                  stroke={s.color}
                  strokeWidth={selected === s.key ? stroke + 6 : stroke}
                  fill="none"
                  opacity={dim(s.key)}
                  onPress={pick && (() => pick(s.key))}
                />
              );
            })}
        </Svg>
        {/* Centre label lets taps through to the slices underneath */}
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: light ? 12 : 11, color: light ? '#ffffffb3' : colors.muted }}>{centerLabel}</Text>
          <Text style={{ fontSize: light ? 22 : 17, fontWeight: light ? '900' : '700', color: light ? '#fff' : colors.text }}>{centerValue}</Text>
        </View>
      </View>
      {legend ? <View style={{ flex: 1, gap: 6 }}>
        {slices.map((s) => (
          <Pressable
            key={s.key}
            disabled={!pick}
            onPress={pick && (() => pick(s.key))}
            accessibilityRole={pick ? 'button' : undefined}
            accessibilityState={pick ? { selected: selected === s.key } : undefined}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: dim(s.key), paddingVertical: pick ? 2 : 0 }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.text, fontWeight: selected === s.key ? '800' : '400' }} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </Text>
          </Pressable>
        ))}
        {slices.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>No spending yet</Text> : null}
        {total > 0 ? <Text style={{ fontSize: 11, color: colors.muted }}>Total {format(total)}</Text> : null}
      </View> : null}
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
  light,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  width: number;
  height?: number;
  format: (n: number) => string;
  /** White grid and labels, for gradient cards. */
  light?: boolean;
}) {
  const grid = light ? '#ffffff2e' : colors.border;
  const muted = light ? '#ffffffb3' : colors.muted;
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
              <Line x1={padLeft} x2={width} y1={y} y2={y} stroke={grid} strokeDasharray="3 3" />
              <SvgText x={padLeft - 6} y={y + 4} fontSize={10} fill={muted} textAnchor="end">
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
              <SvgText x={padLeft + i * groupW + groupW / 2} y={height - 6} fontSize={10} fill={muted} textAnchor="middle">
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
            <Text style={{ fontSize: 12, color: muted }}>{s.name}</Text>
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

/** Smooth curve through the points (Catmull-Rom turned into Bezier segments). */
function smoothPath(pts: { x: number; y: number }[]): string {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Smooth line with a fading fill, e.g. net worth growth. `light` draws white for coloured backgrounds. */
export function AreaChart({ values, labels, width, height = 90, color = colors.primary, light, lineColor }: { values: number[]; labels?: string[]; width: number; height?: number; color?: string; light?: boolean; lineColor?: string }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const stroke = lineColor ?? (light ? '#fff' : color);
  const pad = 8;
  const labelH = labels ? 16 : 0;
  const h = height - labelH;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L ${x(values.length - 1)} ${h} L ${x(0)} ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height} accessibilityLabel="Growth chart">
      <Defs>
        <LinearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={light ? 0.45 : 0.35} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {labels
        ? [0.25, 0.5, 0.75].map((f) => <Line key={f} x1={pad} x2={width - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke={stroke} strokeOpacity={0.15} strokeDasharray="2 6" />)
        : null}
      <Path d={area} fill={`url(#fill${id})`} />
      <Path d={line} stroke={stroke} strokeWidth={labels ? 3 : 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Today: a soft glow around the latest point */}
      <Circle cx={last.x} cy={last.y} r={labels ? 9 : 6} fill={stroke} opacity={0.25} />
      <Circle cx={last.x} cy={last.y} r={labels ? 4.5 : 3} fill={light ? '#1B1F5E' : '#fff'} stroke={stroke} strokeWidth={2} />
      {labels?.map((l, i) => (
        <SvgText key={l + i} x={i === 0 ? 0 : i === labels.length - 1 ? width : x(i)} y={height - 3} fontSize={10} fill={light ? '#ffffffcc' : colors.muted} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Ring gauge: how much of something is used, with the text in the middle. Turns orange near the limit, red over it. */
export function Gauge({ value, size = 92, label, sub }: { value: number; size?: number; label: string; sub?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, value));
  const color = value > 1 ? colors.danger : value > 0.85 ? colors.warning : colors.success;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * shown} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 18, fontWeight: '800', color }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 10, color: colors.muted }}>{sub}</Text> : null}
    </View>
  );
}

/** Two running lines on one scale: `current` (solid, may stop early) against `previous` (dashed). */
export function CompareLines({ current, previous, width, height = 150, format, labels, light }: { current: number[]; previous: number[]; width: number; height?: number; format: (n: number) => string; labels: [string, string]; light?: boolean }) {
  const grid = light ? '#ffffff2e' : colors.border;
  const muted = light ? '#ffffffb3' : colors.muted;
  const main = light ? '#FFD978' : colors.primary;
  const n = Math.max(current.length, previous.length);
  if (n < 2) return null;
  const left = 44;
  const pad = 8;
  const h = height - 18;
  const max = Math.max(1, ...current, ...previous);
  const x = (i: number) => left + (i * (width - left - pad)) / (n - 1);
  const y = (v: number) => pad + (1 - v / max) * (h - pad * 2);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
  return (
    <View style={{ gap: 6 }}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((f) => (
          <G key={f}>
            <Line x1={left} x2={width - pad} y1={y(max * f)} y2={y(max * f)} stroke={grid} strokeDasharray="3 4" />
            <SvgText x={left - 4} y={y(max * f) + 3} fontSize={9} fill={muted} textAnchor="end">
              {format(max * f)}
            </SvgText>
          </G>
        ))}
        <Path d={path(previous)} stroke={muted} strokeWidth={2} strokeDasharray="5 4" fill="none" />
        <Path d={path(current)} stroke={main} strokeWidth={3} fill="none" strokeLinejoin="round" />
        {current.length ? <Circle cx={x(current.length - 1)} cy={y(current[current.length - 1])} r={4} fill={main} /> : null}
        <SvgText x={left} y={height - 2} fontSize={10} fill={muted}>Day 1</SvgText>
        <SvgText x={width - pad} y={height - 2} fontSize={10} fill={muted} textAnchor="end">Day {n}</SvgText>
      </Svg>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Text style={{ fontSize: 12, color: main, fontWeight: '700' }}>━ {labels[0]}</Text>
        <Text style={{ fontSize: 12, color: muted }}>┅ {labels[1]}</Text>
      </View>
    </View>
  );
}

/** Half-circle score gauge (0–100) on a red → orange → green band, with the score in large type. */
export function HealthGauge({ score, label, size = 240, light }: { score: number; label: string; size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = r + stroke / 2;
  const pt = (f: number) => ({ x: cx + r * Math.cos(Math.PI + Math.PI * f), y: cy + r * Math.sin(Math.PI + Math.PI * f) });
  const arc = (f: number) => {
    const s = pt(0);
    const e = pt(Math.max(0.001, Math.min(1, f)));
    return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
  };
  const f = Math.max(0, Math.min(100, score)) / 100;
  const tip = pt(f);
  const color = score >= 80 ? colors.success : score >= 60 ? colors.primary : score >= 40 ? colors.warning : colors.danger;
  const h = cy + stroke / 2 + 4;
  return (
    <View style={{ width: size, alignItems: 'center' }} accessibilityRole="image" accessibilityLabel={`Financial health ${score} out of 100, ${label}`}>
      <View style={{ width: size, height: h }}>
      <Svg width={size} height={h}>
        <Defs>
          <LinearGradient id={`hg${id}`} gradientUnits="userSpaceOnUse" x1={stroke / 2} y1="0" x2={size - stroke / 2} y2="0">
            <Stop offset="0" stopColor={colors.danger} />
            <Stop offset="0.5" stopColor={colors.warning} />
            <Stop offset="1" stopColor={colors.success} />
          </LinearGradient>
        </Defs>
        <Path d={arc(1)} stroke={light ? '#ffffff2e' : colors.border} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {f > 0 ? <Path d={arc(f)} stroke={`url(#hg${id})`} strokeWidth={stroke} strokeLinecap="round" fill="none" /> : null}
        <Circle cx={tip.x} cy={tip.y} r={stroke / 2 + 3} fill="#fff" stroke={color} strokeWidth={4} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 48, fontWeight: '800', color: light ? '#fff' : colors.text, lineHeight: 52 }}>{score}</Text>
        <Text style={{ fontSize: 12, color: light ? '#ffffffaa' : colors.muted }}>out of 100</Text>
      </View>
      </View>
      <View style={{ marginTop: 10, backgroundColor: light ? '#ffffff26' : color + '22', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 5 }}>
        <Text style={{ color: light ? '#FFD978' : color, fontWeight: '800', fontSize: 15 }}>{label}</Text>
      </View>
    </View>
  );
}
