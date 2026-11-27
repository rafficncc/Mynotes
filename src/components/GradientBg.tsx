import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** The app's hero colours (Home net worth card, Cards summary, Insights health). */
export const HERO: [string, string, string] = ['#1B1F5E', '#0E4D64', '#0B6E4F'];

/** Diagonal gradient filling its parent; put it first inside a View with overflow hidden. */
export function GradientBg({ id, colors = HERO }: { id: string; colors?: string[] }) {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {colors.map((c, i) => (
            <Stop key={c + i} offset={i / (colors.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
