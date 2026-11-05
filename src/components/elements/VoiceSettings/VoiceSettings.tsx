import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useColorScheme from '@/hooks/useColorScheme';
import { colors } from '@/theme';
import {
  getHungarianVoiceStatusAsync,
  HungarianVoiceStatus,
  openHungarianVoiceSetupAsync,
  speakHungarianAsync,
} from '@/services/hungarianVoice.service';

export function VoiceSettings() {
  const { t } = useTranslation();
  const { isDark } = useColorScheme();
  const [status, setStatus] = useState<HungarianVoiceStatus | 'checking'>('checking');
  const [testComplete, setTestComplete] = useState(false);
  const refresh = useCallback(async () => {
    setStatus(await getHungarianVoiceStatusAsync());
  }, []);
  useEffect(() => {
    let active = true;
    void getHungarianVoiceStatusAsync().then(result => {
      if (active) setStatus(result);
    });
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [refresh]);
  async function openSetup() {
    if (!(await openHungarianVoiceSetupAsync()))
      Alert.alert(t('voice.title'), t('voice.setupUnavailable'));
  }
  async function testVoice() {
    setTestComplete(false);
    const result = await speakHungarianAsync('Szia!', false);
    if (result === 'started') setTestComplete(true);
    if (result !== 'started' && result !== 'interrupted') {
      await refresh();
      Alert.alert(t('voice.title'), t('voice.playbackError'));
    }
  }
  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDark && { color: colors.white }]}>{t('voice.title')}</Text>
      <Text style={[styles.text, isDark && { color: colors.darkMuted }]}>
        {t(`voice.status.${status}`)}
      </Text>
      {status === 'missing' && (
        <Text style={[styles.text, isDark && { color: colors.darkMuted }]}>
          {t('voice.missing')}
        </Text>
      )}
      {testComplete && (
        <Text
          accessibilityRole="alert"
          style={[styles.text, isDark && { color: colors.darkMuted }]}>
          {t('voice.testComplete')}
        </Text>
      )}
      <View style={styles.row}>
        {status === 'missing' && (
          <TouchableOpacity
            accessibilityRole="button"
            testID="voice-setup"
            onPress={() => void openSetup()}
            style={styles.button}>
            <Text style={styles.buttonText}>{t('voice.openSetup')}</Text>
          </TouchableOpacity>
        )}
        {status === 'ready' && (
          <TouchableOpacity
            accessibilityRole="button"
            testID="voice-test"
            onPress={() => void testVoice()}
            style={styles.button}>
            <Text style={styles.buttonText}>{t('voice.test')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          testID="voice-recheck"
          onPress={() => void refresh()}
          style={styles.button}>
          <Text style={styles.buttonText}>{t('voice.recheck')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 10 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  text: { color: colors.mutedInk, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: colors.teal, padding: 12, borderRadius: 8 },
  buttonText: { color: colors.white, fontWeight: '600' },
});
