import { Slot } from 'expo-router';
import Provider from '@/providers';

export default function RootLayout() {
  return (
    <Provider>
      <Slot />
    </Provider>
  );
}
