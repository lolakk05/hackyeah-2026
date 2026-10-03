/**
 * Vibration feedback (iPhone Taptic Engine / Android vibration), Duolingo-style:
 * short, crisp taps for touches and little rhythms for good moments.
 * All no-ops on web.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const off = Platform.OS === 'web';
const impact = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style).catch(() => {});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const { Light, Medium, Heavy, Rigid, Soft } = Haptics.ImpactFeedbackStyle;

/** Button press (big buttons feel a bit firmer). */
export function tapFeedback(strong = false) {
  if (off) return;
  impact(strong ? Medium : Light);
}

/** Moving a slider a step, ticking a chip or a switch. */
export function selectionFeedback() {
  if (off) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Something worked (signed in, report sent…). */
export function successFeedback() {
  if (off) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something went wrong (wrong password, no connection…). */
export function errorFeedback() {
  if (off) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Answering a question: a crisp "click-thump". */
export async function answerFeedback() {
  if (off) return;
  impact(Rigid);
  await wait(70);
  impact(Soft);
}

/** Reached a stop: two firm knocks. */
export async function arriveFeedback() {
  if (off) return;
  impact(Medium);
  await wait(110);
  impact(Heavy);
}

/** Big moments (trip finished, level up, achievement): a little drum roll + success. */
export async function celebrateFeedback() {
  if (off) return;
  for (const style of [Light, Light, Medium, Heavy]) {
    impact(style);
    await wait(65);
  }
  await wait(80);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Pinek waves at you: a soft double tap. */
export async function waveFeedback() {
  if (off) return;
  impact(Soft);
  await wait(140);
  impact(Soft);
}
