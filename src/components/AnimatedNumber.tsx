import React, { useEffect } from 'react';
import { TextInput, TextStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  value: number;
  duration?: number;
  /** Optional prefix added before the number, e.g. "$". */
  prefix?: string;
  /** Optional suffix added after the number, e.g. "%", " min", " mi". */
  suffix?: string;
  /** Decimal places (0 = integer). Default 0. */
  decimals?: number;
  style?: TextStyle | TextStyle[];
}

/**
 * Counts smoothly from current → target. Uses the TextInput-as-animated-text trick:
 * reanimated's animatedProps can update the native `text` prop of a TextInput
 * every frame on the UI thread, no React re-renders.
 *
 * IMPORTANT: we accept primitive formatting options (prefix/suffix/decimals),
 * NOT a `format` function. In Reanimated 4 the worklet captures crossing the
 * JS↔UI boundary cannot include callable JS functions — they arrive as JSI
 * wrappers, triggering "format is not a function (it is Object)" at runtime.
 * If you need a new format style, add a primitive option here.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
}: Props) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, v]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const num = decimals > 0
      ? v.value.toFixed(decimals)
      : String(Math.round(v.value));
    const display = `${prefix}${num}${suffix}`;
    return { text: display, defaultValue: display } as any;
  });

  // Initial render value (before animation runs)
  const initial = decimals > 0
    ? `${prefix}${(0).toFixed(decimals)}${suffix}`
    : `${prefix}0${suffix}`;

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      value={initial}
      animatedProps={animatedProps}
      style={[styles.input, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    includeFontPadding: false as any,
    textAlignVertical: 'center',
  },
});
