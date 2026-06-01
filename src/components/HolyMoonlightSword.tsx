import React, { useEffect, useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Path, Rect, Ellipse, Circle, Polygon, Line, G,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);

// Artwork is authored in a 300 × 60 space (5:1). The container measures its
// width and sets height = width / 5 so the sword fills the row with no
// distortion, hilt flush to the left edge, moonlight tip at the right.
const VB_W = 300;
const VB_H = 60;
const ASPECT = VB_W / VB_H;

interface Props {
  /** Optional style on the wrapper (margins etc.). */
  style?: any;
}

/**
 * Bloodborne "Holy Moonlight Sword" (activated) rendered as a horizontal
 * emblem — ornate gold hilt on the left, steel ricasso, and a translucent
 * glowing blue moonlight blade tapering to a point on the right. The
 * moonlight aura + core pulse continuously to read as "charged".
 *
 * Pure react-native-svg + reanimated (no native blur), so it's Expo Go safe.
 */
export function HolyMoonlightSword({ style }: Props) {
  const [w, setW] = useState(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [glow]);

  // Outer aura breathes wider/brighter; core stays bright with a subtle pulse.
  const auraProps = useAnimatedProps(() => ({ opacity: 0.35 + glow.value * 0.55 }));
  const coreProps = useAnimatedProps(() => ({ opacity: 0.7 + glow.value * 0.3 }));
  const beamProps = useAnimatedProps(() => ({ opacity: 0.25 + glow.value * 0.45 }));

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const height = w > 0 ? w / ASPECT : 44;

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <LinearGradient id="hmsGrip" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2a2f36" />
              <Stop offset="0.5" stopColor="#4a525c" />
              <Stop offset="1" stopColor="#1d2228" />
            </LinearGradient>
            <LinearGradient id="hmsGold" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7a5a1e" />
              <Stop offset="0.5" stopColor="#f6d98a" />
              <Stop offset="1" stopColor="#9c6f1e" />
            </LinearGradient>
            <LinearGradient id="hmsSteel" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#8b929c" />
              <Stop offset="0.5" stopColor="#eef2f7" />
              <Stop offset="1" stopColor="#555c66" />
            </LinearGradient>
            <LinearGradient id="hmsMoon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#cdefff" stopOpacity="0.55" />
              <Stop offset="0.5" stopColor="#5bb8ff" stopOpacity="0.92" />
              <Stop offset="1" stopColor="#1f63c8" stopOpacity="0.55" />
            </LinearGradient>
            <LinearGradient id="hmsCore" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#bff0ff" stopOpacity="0.6" />
            </LinearGradient>
            <RadialGradient id="hmsGlow" cx="180" cy="30" r="140" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#bff0ff" stopOpacity="0.85" />
              <Stop offset="0.45" stopColor="#3aa6ff" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#1e5fbf" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* --- Glow aura (animated) — drawn first so blade sits on top --- */}
          <AnimatedG animatedProps={auraProps}>
            <Ellipse cx="185" cy="30" rx="120" ry="28" fill="url(#hmsGlow)" />
          </AnimatedG>
          <AnimatedG animatedProps={beamProps}>
            <Ellipse cx="190" cy="30" rx="135" ry="10" fill="url(#hmsGlow)" />
          </AnimatedG>

          {/* --- Hilt: pommel + wrapped grip --- */}
          <Circle cx="7" cy="30" r="5.5" fill="url(#hmsGold)" stroke="#5a4214" strokeWidth="0.6" />
          <Circle cx="7" cy="30" r="2" fill="#3a2c0e" />
          <Rect x="11" y="24" width="33" height="12" rx="2" fill="url(#hmsGrip)" stroke="#15191e" strokeWidth="0.6" />
          {[18, 24, 30, 36, 42].map((x) => (
            <Line key={x} x1={x} y1="24.5" x2={x} y2="35.5" stroke="#11151a" strokeWidth="0.8" opacity={0.7} />
          ))}

          {/* --- Ornate gold crossguard --- */}
          <Path d="M55 13 q 11 -3 15 5" stroke="url(#hmsGold)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Path d="M55 47 q 11 3 15 -5" stroke="url(#hmsGold)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Ellipse cx="55" cy="30" rx="5.5" ry="18" fill="url(#hmsGold)" stroke="#5a4214" strokeWidth="0.6" />
          <Circle cx="55" cy="30" r="3.2" fill="#bff0ff" />
          <Circle cx="55" cy="30" r="3.2" fill="#3aa6ff" opacity={0.5} />

          {/* --- Steel ricasso (blade base) --- */}
          <Polygon points="60,25 92,27 92,33 60,35" fill="url(#hmsSteel)" stroke="#3a4049" strokeWidth="0.5" />

          {/* --- Moonlight blade --- */}
          <Polygon
            points="82,22 122,17.5 296,30 122,42.5 82,38"
            fill="url(#hmsMoon)"
            stroke="#cfeeff"
            strokeWidth="0.8"
            strokeOpacity={0.7}
          />
          {/* bright animated core spine */}
          <AnimatedG animatedProps={coreProps}>
            <Polygon points="104,27.5 296,30 104,32.5" fill="url(#hmsCore)" />
          </AnimatedG>
          {/* top edge highlight */}
          <Path d="M86 22 L122 17.8 L296 30" stroke="#eaffff" strokeWidth="0.7" fill="none" strokeOpacity={0.8} />

          {/* --- Sparkle motes along the blade --- */}
          <Circle cx="150" cy="24" r="1.1" fill="#eaffff" opacity={0.8} />
          <Circle cx="205" cy="34" r="0.9" fill="#eaffff" opacity={0.7} />
          <Circle cx="245" cy="28" r="0.8" fill="#eaffff" opacity={0.6} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
