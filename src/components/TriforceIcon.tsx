import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Polygon, G } from 'react-native-svg';
import { zelda } from '../theme';

interface Props {
  size?: number;
  color?: string;
  glow?: boolean;
  style?: ViewStyle;
}

/**
 * Three-triangle Triforce icon. Used in CelebrationOverlay and as a brand mark.
 */
export function TriforceIcon({ size = 64, color = zelda.triforceGold, glow = false, style }: Props) {
  const t = size / 2;            // small triangle side
  const w = size;                // overall width
  const h = (size * Math.sqrt(3)) / 2; // overall height

  // Vertices for a triforce of 3 upward-pointing small triangles
  // top: apex (w/2, 0), bl (w/2 - t/2, h/2), br (w/2 + t/2, h/2)
  // bl: apex (w/4, h/2), bl (0, h), br (w/2, h)
  // br: apex (3w/4, h/2), bl (w/2, h), br (w, h)
  const top = `${w / 2},0 ${w / 2 - t / 2},${h / 2} ${w / 2 + t / 2},${h / 2}`;
  const bl  = `${w / 4},${h / 2} ${0},${h} ${w / 2},${h}`;
  const br  = `${3 * w / 4},${h / 2} ${w / 2},${h} ${w},${h}`;

  return (
    <View style={[styles.wrap, { width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <G>
          <Polygon points={top} fill={color} stroke={zelda.triforceGoldDeep} strokeWidth={1} />
          <Polygon points={bl}  fill={color} stroke={zelda.triforceGoldDeep} strokeWidth={1} />
          <Polygon points={br}  fill={color} stroke={zelda.triforceGoldDeep} strokeWidth={1} />
        </G>
      </Svg>
      {glow && <View style={[styles.glow, { backgroundColor: color, width: w * 1.4, height: w * 1.4, top: -w * 0.2, left: -w * 0.2 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.18,
    zIndex: -1,
  },
});
