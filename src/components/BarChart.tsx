import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { colors, fontSize, radius, spacing } from '../theme';

export interface BarPoint {
  label: string;
  value: number;
}

interface Props {
  title: string;
  subtitle?: string;
  data: BarPoint[];
  color?: string;
  height?: number;
  /** Format y-axis / tooltip values. Default rounds to int. */
  format?: (v: number) => string;
  /** Value for the dashed target line. Optional. */
  target?: number;
  emptyMessage?: string;
}

export function BarChart({
  title, subtitle, data, color = colors.primary,
  height = 150, format, target, emptyMessage,
}: Props) {
  const [w, setW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
  };

  const fmt = format ?? ((v: number) => String(Math.round(v)));
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const innerW = Math.max(0, w - padL - padR);
  const innerH = Math.max(0, height - padT - padB);

  const max = Math.max(1, ...data.map((d) => d.value), target ?? 0);
  const niceMax = niceCeil(max);

  const allZero = data.every((d) => d.value === 0);

  const barGap = 4;
  const barW = data.length > 0
    ? Math.max(2, (innerW - barGap * Math.max(0, data.length - 1)) / data.length)
    : 0;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const latest = data.length > 0 ? data[data.length - 1].value : 0;

  const handlePress = (e: any) => {
    if (data.length === 0) return;
    const x = e.nativeEvent.locationX;
    if (x < padL || x > padL + innerW) {
      setActiveIdx(null);
      return;
    }
    // Each bar (with its trailing gap) is (barW + barGap) wide.
    const step = barW + barGap;
    const idx = Math.max(0, Math.min(data.length - 1, Math.floor((x - padL) / step)));
    setActiveIdx(idx === activeIdx ? null : idx);
  };

  // Tooltip geometry
  const tooltip = (() => {
    if (activeIdx == null || !data[activeIdx]) return null;
    const x = padL + activeIdx * (barW + barGap) + barW / 2;
    const valStr = fmt(data[activeIdx].value);
    const label = data[activeIdx].label;
    const tooltipW = 100;
    const tooltipH = 38;
    let tx = x + 8;
    if (tx + tooltipW > w - 4) tx = x - tooltipW - 8;
    if (tx < 4) tx = 4;
    const ty = padT + 4;
    return { x, tx, ty, tooltipW, tooltipH, valStr, label };
  })();

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.stats}>
          <Stat label="Latest" value={fmt(latest)} />
          <Stat label="Avg" value={fmt(avg)} />
          <Stat label="Total" value={fmt(total)} />
        </View>
      </View>

      {w > 0 && (
        <Pressable onPress={handlePress}>
          <Svg width={w} height={height}>
            {/* horizontal grid + y labels: 0, mid, max */}
            {[0, 0.5, 1].map((frac) => {
              const y = padT + innerH * (1 - frac);
              return (
                <G key={frac}>
                  <Line
                    x1={padL} y1={y} x2={padL + innerW} y2={y}
                    stroke={colors.border} strokeWidth={1} strokeDasharray={frac === 0 ? undefined : '3,4'}
                  />
                  <SvgText
                    x={padL - 4} y={y + 4}
                    fill={colors.textFaint} fontSize={10} textAnchor="end"
                  >
                    {fmt(niceMax * frac)}
                  </SvgText>
                </G>
              );
            })}

            {/* target line */}
            {target && target > 0 && (
              <Line
                x1={padL} x2={padL + innerW}
                y1={padT + innerH * (1 - target / niceMax)}
                y2={padT + innerH * (1 - target / niceMax)}
                stroke={colors.warn} strokeWidth={1.5} strokeDasharray="6,4"
              />
            )}

            {/* bars */}
            {data.map((d, i) => {
              const x = padL + i * (barW + barGap);
              const h = niceMax === 0 ? 0 : innerH * (d.value / niceMax);
              const y = padT + innerH - h;
              const isLast = i === data.length - 1;
              const isActive = activeIdx === i;
              return (
                <G key={i}>
                  <Rect
                    x={x} y={y} width={barW} height={Math.max(0, h)}
                    rx={Math.min(3, barW / 4)}
                    fill={isActive ? color : (isLast ? color : color + 'AA')}
                    opacity={activeIdx != null && !isActive ? 0.5 : 1}
                  />
                  {/* x label every other for dense series */}
                  {(data.length <= 8 || i % 2 === 0 || isLast) && (
                    <SvgText
                      x={x + barW / 2} y={padT + innerH + 14}
                      fill={colors.textFaint} fontSize={9} textAnchor="middle"
                    >
                      {d.label}
                    </SvgText>
                  )}
                </G>
              );
            })}

            {/* Tooltip overlay */}
            {tooltip && (
              <G>
                {/* highlight bar with a darker outline already handled above */}
                <Line
                  x1={tooltip.x} x2={tooltip.x}
                  y1={padT} y2={padT + innerH}
                  stroke={colors.text} strokeWidth={1} strokeDasharray="4,4" opacity={0.4}
                />
                <Rect
                  x={tooltip.tx} y={tooltip.ty}
                  width={tooltip.tooltipW} height={tooltip.tooltipH}
                  rx={6} ry={6}
                  fill={colors.bg} stroke={colors.border} strokeWidth={1} opacity={0.97}
                />
                <SvgText
                  x={tooltip.tx + 8} y={tooltip.ty + 14}
                  fill={colors.textDim} fontSize={10} fontWeight="700"
                >
                  {tooltip.label}
                </SvgText>
                <SvgText
                  x={tooltip.tx + tooltip.tooltipW - 8} y={tooltip.ty + 30}
                  fill={color} fontSize={13} fontWeight="800" textAnchor="end"
                >
                  {tooltip.valStr}
                </SvgText>
              </G>
            )}
          </Svg>
        </Pressable>
      )}

      {allZero && emptyMessage && (
        <Text style={styles.empty}>{emptyMessage}</Text>
      )}
      {!allZero && activeIdx == null && data.length > 0 && (
        <Text style={styles.hint}>Tap a bar to see its value.</Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let nice;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 2.5) nice = 2.5;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { alignItems: 'flex-end' },
  statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs, letterSpacing: 0.4 },
  empty: { color: colors.textDim, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  hint: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
