import * as Haptics from 'expo-haptics';

/**
 * Semantic haptic helpers. Wrapped so the rest of the app doesn't import
 * expo-haptics directly, and so we can stub these out for testing later.
 *
 * All return promises but are safe to fire-and-forget.
 */

/** Light tap — picking, selecting, tab switches. */
export function tap() {
  return Haptics.selectionAsync().catch(() => {});
}

/** Medium impact — confirmations like "saved". */
export function tick() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Heavier thunk — for the "load deposited" moment. */
export function thunk() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success ping — goal hit, milestone unlocked. */
export function success() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — overreaching, validation warning. */
export function warn() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error — destructive or invalid action. */
export function error() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
