import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Holy Moonlight Sword — the supplied artwork sits STATIC; only a soft
 * light-blue glow behind it breathes. Animating just one SVG opacity (UI
 * thread) keeps it smooth — the old version animated scale+rotate on the large
 * image every frame, which forced a re-rasterize and tanked the framerate.
 *
 * Needs `assets/moonlight-sword.png` (a transparent, background-removed PNG).
 * A transparent placeholder ships there so the bundle never breaks.
 */
const SWORD = require('../../assets/moonlight-sword.png');

// Source art runs diagonally (hilt upper-right → tip lower-left). 225° lays the
// blade roughly horizontal, hilt on the LEFT. Tweak if orientation looks off.
const ROTATION = '225deg';

interface Props {
  style?: any;
}

export function HolyMoonlightSword({ style }: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);

  // Subtle: low, slow opacity breathe.
  const glowProps = useAnimatedProps(() => ({ opacity: 0.12 + t.value * 0.2 }));

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      {/* Light-blue glow biased toward the blade (lower-left) so it doesn't
          wash the iron hilt. Only its opacity animates. */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="mlGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#A9D8FF" stopOpacity="0.85" />
            <Stop offset="0.55" stopColor="#5BA8FF" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#3A7BD0" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <AnimatedG animatedProps={glowProps}>
          <Ellipse cx="42" cy="60" rx="44" ry="30" fill="url(#mlGlow)" />
        </AnimatedG>
      </Svg>

      {/* Static sword artwork — with a soft cyan lift (iOS) */}
      <Image source={SWORD} resizeMode="contain" style={styles.img} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  img: {
    width: '122%',
    height: '122%',
    transform: [{ rotate: ROTATION }],
    // Soft cyan lift so the blade pops off the dark UI (iOS; no-op on Android).
    shadowColor: '#5BA8FF',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
});
