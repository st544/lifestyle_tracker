/**
 * Sound effect stubs. Audio is intentionally not wired up in v1 because
 * shipping legally-clean Zelda-inspired chimes requires the user to drop
 * their own .mp3/.wav assets into `assets/sounds/`.
 *
 * When you add files, swap each function body to use `expo-audio`:
 *
 *   import { useAudioPlayer } from 'expo-audio';
 *   // or for one-shots:
 *   import { Audio } from 'expo-av';
 *   const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/itemGet.mp3'));
 *   await sound.playAsync();
 *
 * For now these are silent and safe to call from anywhere.
 */

export function playItemGet() { /* TODO: ../assets/sounds/itemGet.mp3 */ }
export function playSecret() { /* TODO: ../assets/sounds/secret.mp3 */ }
export function playChestOpen() { /* TODO: ../assets/sounds/chest.mp3 */ }
export function playRupee() { /* TODO: ../assets/sounds/rupee.mp3 */ }
export function playHeart() { /* TODO: ../assets/sounds/heart.mp3 */ }
