# Offline Hungarian voice plan

## Experience

A normal and a slow speaker control appear with Hungarian words in practice and the dictionary. A sentence's full pronunciation appears only after revealing the missing word. The controls are accessible, localized, and never affect grading. Settings shows voice availability, an installation shortcut when data is missing, a test phrase when ready, and a recheck control.

On Android, initialize the device's default text-to-speech engine, find Hungarian voices, exclude network-dependent voices and voices reporting uninstalled data, then explicitly select an eligible voice. Do not fall back to another language or network-only synthesis. If none is ready, explain the one-time download and let the user open the engine's installer; on return, recheck. Installer cancellation, a missing engine, rejected voice selection, and failed playback leave practice usable and show a helpful message. The system installer varies by device; if it cannot open, guide the user to system text-to-speech settings.

The native engine controls the downloaded data and voice quality. No speech text is sent to an app server. The Android engine's offline flag is the platform's report; verify on real hardware in airplane mode. Other platforms currently show voice as unavailable rather than claiming offline support. Do not change practice data, score, or download voice files silently.

## Validation

Unit-test normal/slow calls, missing voice and setup failure, unsupported platforms, voice state transitions and grading isolation. Build a standalone Android app with the local module. On a connected phone verify installed-voice playback in airplane mode, plus the missing/uninstalled flow where practical without deleting the user's voice data. Recheck after returning from setup. Note any test that cannot be safely reproduced.

References: https://developer.android.com/reference/android/speech/tts/Voice#isNetworkConnectionRequired() and https://developer.android.com/reference/android/speech/tts/TextToSpeech.Engine#ACTION_INSTALL_TTS_DATA. Expo Speech's available-voice API does not expose the Android network-required flag: https://docs.expo.dev/versions/latest/sdk/speech/.
