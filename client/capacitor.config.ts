import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pavalononlinemultiplayer.app',
  appName: 'Pavalon Online Multiplayer ',
  webDir: 'out',
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
      backgroundColor: '#00000000', // Transparent
    },
  },
};

export default config;
