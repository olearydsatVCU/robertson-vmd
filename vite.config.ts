import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const single = !!process.env.VITE_SINGLE_FILE

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  build: single ? { outDir: 'single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : undefined,
})
