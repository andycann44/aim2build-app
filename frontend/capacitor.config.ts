import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "uk.co.aim2build.app",
  appName: "Aim2Build",
  webDir: "dist",
  server: {
    url: "http://127.0.0.1:5173",
    cleartext: true
  }
};

export default config;
