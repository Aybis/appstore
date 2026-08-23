import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // react-router 7 ships syntax esbuild refuses to downlevel to Vite's default
  // dep-optimizer baseline (es2020 / safari14), which fails the prebundle with
  // "Transforming destructuring ... is not supported yet". The console is an
  // internal tool on current browsers, so raising the floor is the right fix
  // rather than pinning an older router.
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  build: { target: 'es2022' },
  server: {
    port: 5173,
    // Bound to all interfaces so the console is reachable from the same LAN the
    // emulator and any test device already use to reach the API.
    host: true,
  },
})
