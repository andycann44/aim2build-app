import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "uk.co.aim2build.app",
  appName: "Aim2Build",
  webDir: "dist",
  server: {
  url: "https://aim2build.co.uk",
  cleartext: false,
  allowNavigation: ["aim2build.co.uk", "*.aim2build.co.uk"]
  }
};

export default config;
