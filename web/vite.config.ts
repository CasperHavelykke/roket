import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import fs from 'fs'

// Stamp the service worker with a unique cache name on each build
function swVersionPlugin() {
  return {
    name: 'sw-version',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf8')
        content = content.replace('__BUILD_TIME__', Date.now().toString())
        fs.writeFileSync(swPath, content)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), svgr(), swVersionPlugin()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
})
