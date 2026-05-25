import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  text: string;
  /** ms per character */
  speed?: number;
  /** Delay before typing starts. */
  delay?: number;
  style?: TextStyle | TextStyle[];
}

/**
 * Reveals text character-by-character. Zelda-style dialog box pacing.
 * Re-runs when `text` changes. Uses JS setInterval — fine for ~200-char strings.
 *
 * NOTE: in React Native `setTimeout`/`setInterval` return numbers, NOT objects.
 * Do not try to attach properties to them — store IDs in plain variables that
 * the cleanup closure can capture.
 */
export function TypewriterText({ text, speed = 18, delay = 0, style }: Props) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    let i = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      intervalId = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length && intervalId !== undefined) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startId);
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
    };
  }, [text, speed, delay]);

  return <Text style={style}>{shown}</Text>;
}
