import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)))
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
