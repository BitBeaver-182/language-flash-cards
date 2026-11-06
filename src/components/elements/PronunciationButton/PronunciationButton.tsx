import { useEffect, useRef } from 'react';
import { Alert, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useColorScheme from '@/hooks/useColorScheme';
import { colors } from '@/theme';
import {
  getHungarianVoiceStatusAsync,
  openHungarianVoiceSetupAsync,
  speakHungarianAsync,
} from '@/services/hungarianVoice.service';

export interface PronunciationButtonProps {
  text: string;
}
export function PronunciationButton({ text }: PronunciationButtonProps) {
  const { t } = useTranslation();
  const { isDark } = useColorScheme();
  const waitingForSetup = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || !waitingForSetup.current) return;
      waitingForSetup.current = false;
      void getHungarianVoiceStatusAsync().then(status => {
        Alert.alert(t('voice.title'), t(status === 'ready' ? 'voice.ready' : 'voice.notReady'));
      });
    });
    return () => sub.remove();
  }, [t]);
  async function speak(slow: boolean) {
    const result = await speakHungarianAsync(text, slow);
    if (result === 'started' || result === 'interrupted') return;
    if (result === 'missing') {
      Alert.alert(t('voice.title'), t('voice.missing'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('voice.openSetup'),
          onPress: () => {
            waitingForSetup.current = true;
            void openHungarianVoiceSetupAsync().then(opened => {
              if (!opened) {
                waitingForSetup.current = false;
                Alert.alert(t('voice.title'), t('voice.setupUnavailable'));
              }
            });
          },
        },
      ]);
      return;
    }
    Alert.alert(
      t('voice.title'),
      t(result === 'unavailable' ? 'voice.unavailable' : 'voice.playbackError'),
    );
  }
  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('voice.play', { word: text })}
        testID="pronounce-normal"
        style={styles.button}
        onPress={() => void speak(false)}>
        <Ionicons
          name="volume-high-outline"
          size={23}
          color={isDark ? colors.darkTeal : colors.teal}
        />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('voice.playSlow', { word: text })}
        testID="pronounce-slow"
        style={styles.button}
        onPress={() => void speak(true)}>
        <Text style={[styles.slow, { color: isDark ? colors.darkTeal : colors.teal }]}>0.5×</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  slow: { fontSize: 14, fontWeight: '700' },
  button: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
