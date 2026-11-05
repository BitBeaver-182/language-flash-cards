import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const expoProjectId = process.env.EXPO_PROJECT_ID ?? '18adc0d0-eb1d-11e9-8009-d524ed5cc4a7';
  const expoConfig: ExpoConfig = {
    ...config,
    slug: process.env.EXPO_SLUG ?? 'magyar-recall',
    name: process.env.EXPO_NAME ?? 'Beszélj!',
    scheme: 'magyar-recall',
    owner: undefined,
    ios: {
      ...config.ios,
      bundleIdentifier:
        process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.watarumaeda.react-native-boilerplate',
      infoPlist: {
        ...config.ios?.infoPlist,
        // opt out of iOS 26 Liquid Glass so header buttons keep a plain background
        UIDesignRequiresCompatibility: true,
      },
    },
    android: {
      ...config.android,
      package: process.env.EXPO_ANDROID_PACKAGE ?? 'com.magyarrecall.app',
    },
    web: {
      ...config.web,
      bundler: 'metro',
      output: 'static',
      favicon: './src/assets/images/beszelj-icon.png',
    },
    updates: {
      enabled: false,
      url: `https://u.expo.dev/${expoProjectId}`,
    },
    extra: {
      ...config.extra,
      eas: { projectId: expoProjectId },
      env: process.env.ENV ?? 'dev',
      apiUrl: process.env.API_URL ?? 'https://example.com',
      // add more env variables here...
    },
    plugins: [
      'expo-router',
      'expo-asset',
      'expo-notifications',
      'expo-document-picker',
      'expo-sharing',
      'expo-image',
      'expo-status-bar',
      'expo-web-browser',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#101212',
          },
          image: './src/assets/images/beszelj-splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './src/assets/fonts/OpenSans-Bold.ttf',
            './src/assets/fonts/OpenSans-BoldItalic.ttf',
            './src/assets/fonts/OpenSans-Italic.ttf',
            './src/assets/fonts/OpenSans-Regular.ttf',
            './src/assets/fonts/OpenSans-Semibold.ttf',
            './src/assets/fonts/OpenSans-SemiboldItalic.ttf',
          ],
        },
      ],
    ],
  };
  // console.log('[##] expo config', expoConfig);
  return expoConfig;
};
