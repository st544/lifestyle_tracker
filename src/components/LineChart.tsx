import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { colors, fontSize, radius, spacing } from '../theme';

export interface LinePoint {
  label: string;
  /** null = no data for this x; the line skips that point. */
  value: number | null;
}

export interface LineSeries {
  name: string;
  color: string;
  data: LinePoint[];
  /** "left" or "right" — for dual-axis overlay (default "left"). */
  yAxis?: 'left' | 'right';
  /** Format the value for the tooltip + axis label. */
  format?: (v: number) => string;
}

interface Props {
  title?: string;
  subtitle?: string;
  series: LineSeries[];
  height?: number;
  /** Optional dashed horizontal target line on the LEFT axis. */
  targetLeft?: number;
  /** Optional dashed horizontal target line on the RIGHT axis. */
  targetRight?: number;
  emptyMessage?: string;
}

/**
 * Multi-series line chart with:
 *   - Optional dual y-axis (overlay two metrics with very different scales)
 *   - Tap-to-show tooltip — tap anywhere on the chart, get a vertical guide
 *     line snapping to the nearest x-index and a labeled value for every
 *     active series at that x.
 *   - Null-tolerant: gaps in data render as gaps in the line.
 *
 * Built on react-native-svg + Pressable. No gesture-handler dependency.
 */
export function LineChart({
  title, subtitle, series, height = 220, targetLeft, targetRight, emptyMessage,
}: Props) {
  const [w, setW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // All series share the same x-axis (same length). Use the first series'
  // labels for axis ticks.
  const xLen = Math.max(0, ...series.map((s) => s.data.length));
  const labels = series[0]?.data.map((d) => d.label) ?? [];

  // Compute padding based on whether we have right-axis series
  const hasRight = series.some((s) => s.yAxis === 'right');
  const padL = 36;
  const padR = hasRight ? 36 : 8;
  const padT = 12;
  const padB = 26;
  const innerW = Math.max(0, w - padL - padR);
  const innerH = Math.max(0, height - padT - padB);

  // Independent scale per axis
  const leftValues = series
    .filter((s) => (s.yAxis ?? 'left') === 'left')
    .flatMap((s) => s.data.map((d) => d.value).filter((v): v is number => typeof v === 'number'));
  const rightValues = series
    .filter((s) => s.yAxis === 'right')
    .flatMap((s) => s.data.map((d) => d.value).filter((v): v is number => typeof v === 'number'));

  const leftMax = niceMax(Math.max(1, ...leftValues, targetLeft ?? 0));
  const rightMax = niceMax(Math.max(1, ...rightValues, targetRight ?? 0));

  // X position for a given index
  const xAt = (i: number) => {
    if (xLen <= 1) return padL + innerW / 2;
    return padL + (i / (xLen - 1)) * innerW;
  };
  const yAt = (v: number, axis: 'left' | 'right' = 'left') => {
    const max = axis === 'right' ? rightMax : leftMax;
    if (max <= 0) return padT + innerH;
    return padT + innerH * (1 - v / max);
  };

  const handlePress = (e: any) => {
    const x = e.nativeEvent.locationX;
    if (xLen <= 0) return;
    const ratio = Math.max(0, Math.min(1, (x - padL) / innerW));
    const idx = Math.round(ratio * (xLen - 1));
    setActiveIdx(idx === activeIdx ? null : idx);
  };

  const allEmpty = series.every((s) => s.data.every((d) => d.value == null));

  // Build polyline `points` strings — split into runs separated by nulls so
  // gaps show as breaks in the line instead of straight lines across.
  const seriesRuns = (s: LineSeries) => {
    const runs: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    s.data.forEach((d, i) => {
      if (d.value == null) {
        if (current.length > 0) { runs.push(current); current = []; }
      } else {
        current.push({ x: xAt(i), y: yAt(d.value, s.yAxis ?? 'left') });
      }
    });
    if (current.length > 0) runs.push(current);
    return runs;
  };

  // Tooltip position + content
  const tooltip = (() => {
    if (activeIdx == null) return null;
    const x = xAt(activeIdx);
    const lines = series.map((s) => {
      const d = s.data[activeIdx];
      const fmt = s.format ?? ((v: number) => String(Math.round(v)));
      const valStr = d?.value == null ? '—' : fmt(d.value);
      return { name: s.name, color: s.color, valStr };
    });
    const dateLabel = labels[activeIdx] ?? '';
    // Tooltip box dimensions
    const lineH = 16;
    const headerH = 18;
    const padding = 8;
    const tooltipW = 132;
    const tooltipH = headerH + lines.length * lineH + padding;
    // Position: prefer right of guide, flip to left if it would overflow
    let tx = x + 8;
    if (tx + tooltipW > w - 4) tx = x - tooltipW - 8;
    if (tx < 4) tx = 4;
    const ty = padT + 4;
    return { x, tx, ty, tooltipW, tooltipH, lineH, headerH, padding, lines, dateLabel };
  })();

  return (
    <View style={styles.card} onLayout={onLayout}>
      {title ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {/* Legend */}
          <View style={styles.legend}>
            {series.map((s) => (
              <View key={s.name} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {w > 0 && (
        <Pressable onPress={handlePress}>
          <Svg width={w} height={height}>
            {/* Horizontal grid + left y-axis labels (0, mid, max) */}
            {[0, 0.5, 1].map((frac) => {
              const y = padT + innerH * (1 - frac);
              const leftVal = leftMax * frac;
              return (
                <G key={`grid-${frac}`}>
                  <Line x1={padL} y1={y} x2={padL + innerW} y2={y}
                    stroke={colors.border} strokeWidth={1}
                    strokeDasharray={frac === 0 ? undefined : '3,4'} />
                  <SvgText x={padL - 4} y={y + 4}
                    fill={colors.textFaint} fontSize={10} textAnchor="end">
                    {formatAxis(leftVal, leftMax)}
                  </SvgText>
                  {hasRight && (
                    <SvgText x={padL + innerW + 4} y={y + 4}
                      fill={colors.textFaint} fontSize={10} textAnchor="start">
                      {formatAxis(rightMax * frac, rightMax)}
                    </SvgText>
                  )}
                </G>
              );
            })}

            {/* Target lines */}
            {targetLeft != null && targetLeft > 0 && (
              <Line
                x1={padL} x2={padL + innerW}
                y1={yAt(targetLeft, 'left')} y2={yAt(targetLeft, 'left')}
                stroke={colors.warn} strokeWidth={1.2} strokeDasharray="6,4" opacity={0.7}
              />
            )}
            {targetRight != null && targetRight > 0 && hasRight && (
              <Line
                x1={padL} x2={padL + innerW}
                y1={yAt(targetRight, 'right')} y2={yAt(targetRight, 'right')}
                stroke={colors.warn} strokeWidth={1.2} strokeDasharray="6,4" opacity={0.5}
              />
            )}

            {/* Series lines */}
            {series.map((s) => {
              const runs = seriesRuns(s);
              return (
                <G key={s.name}>
                  {runs.map((run, ri) => (
                    <Polyline
                      key={`${s.name}-${ri}`}
                      points={run.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {/* Dots at each point */}
                  {s.data.map((d, i) => {
                    if (d.value == null) return null;
                    return (
                      <Circle
                        key={`${s.name}-pt-${i}`}
                        cx={xAt(i)} cy={yAt(d.value, s.yAxis ?? 'left')}
                        r={activeIdx === i ? 4 : 2.5}
                        fill={s.color}
                      />
                    );
                  })}
                </G>
              );
            })}

            {/* X-axis labels — show first, last, and a few in between */}
            {labels.map((lbl, i) => {
              if (xLen <= 8 || i === 0 || i === xLen - 1 || i % Math.ceil(xLen / 6) === 0) {
                return (
                  <SvgText
                    key={`xlbl-${i}`}
                    x={xAt(i)} y={padT + innerH + 16}
                    fill={colors.textFaint} fontSize={9} textAnchor="middle"
                  >
                    {lbl}
                  </SvgText>
                );
              }
              return null;
            })}

            {/* Tooltip guide line + box */}
            {tooltip && (
              <G>
                <Line
                  x1={tooltip.x} x2={tooltip.x}
                  y1={padT} y2={padT + innerH}
                  stroke={colors.text} strokeWidth={1} strokeDasharray="4,4" opacity={0.55}
                />
                <Rect
                  x={tooltip.tx} y={tooltip.ty}
                  width={tooltip.tooltipW} height={tooltip.tooltipH}
                  rx={6} ry={6}
                  fill={colors.bg} stroke={colors.border} strokeWidth={1} opacity={0.97}
                />
                <SvgText
                  x={tooltip.tx + tooltip.padding} y={tooltip.ty + 13}
                  fill={colors.textDim} fontSize={10} fontWeight="700"
                >
                  {tooltip.dateLabel}
                </SvgText>
                {tooltip.lines.map((line, i) => (
                  <G key={line.name}>
                    <Circle
                      cx={tooltip.tx + tooltip.padding + 4}
                      cy={tooltip.ty + tooltip.headerH + i * tooltip.lineH + 4}
                      r={3} fill={line.color}
                    />
                    <SvgText
                      x={tooltip.tx + tooltip.padding + 12}
                      y={tooltip.ty + tooltip.headerH + i * tooltip.lineH + 7}
                      fill={colors.textDim} fontSize={10}
                    >
                      {line.name}
                    </SvgText>
                    <SvgText
                      x={tooltip.tx + tooltip.tooltipW - tooltip.padding}
                      y={tooltip.ty + tooltip.headerH + i * tooltip.lineH + 7}
                      fill={colors.text} fontSize={11} fontWeight="700" textAnchor="end"
                    >
                      {line.valStr}
                    </SvgText>
                  </G>
                ))}
              </G>
            )}
          </Svg>
        </Pressable>
      )}

      {allEmpty && emptyMessage && (
        <Text style={styles.empty}>{emptyMessage}</Text>
      )}
      {!allEmpty && activeIdx == null && (
        <Text style={styles.hint}>Tap the chart to see exact values for a day.</Text>
      )}
    </View>
  );
}

function niceMax(v: number): number {
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

function formatAxis(v: number, max: number): string {
  if (max >= 100) return String(Math.round(v));
  if (max >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  empty: { color: colors.textDim, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  hint: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
