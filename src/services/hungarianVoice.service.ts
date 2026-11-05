import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type HungarianVoiceStatus = 'ready' | 'missing' | 'unavailable';
export type HungarianSpeechResult = 'started' | 'interrupted' | 'missing' | 'unavailable' | 'error';
interface HungarianVoiceNative {
  status(): Promise<HungarianVoiceStatus>;
  speak(text: string, slow: boolean): Promise<HungarianSpeechResult>;
  openSetup(): Promise<boolean>;
}

const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<HungarianVoiceNative>('HungarianVoice')
    : null;
export async function getHungarianVoiceStatusAsync(): Promise<HungarianVoiceStatus> {
  try {
    return (await native?.status()) ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}
export async function speakHungarianAsync(
  text: string,
  slow = false,
): Promise<HungarianSpeechResult> {
  if (!text.trim()) return 'error';
  try {
    return (await native?.speak(text, slow)) ?? 'unavailable';
  } catch {
    return 'error';
  }
}
export async function openHungarianVoiceSetupAsync(): Promise<boolean> {
  try {
    return (await native?.openSetup()) ?? false;
  } catch {
    return false;
  }
}
