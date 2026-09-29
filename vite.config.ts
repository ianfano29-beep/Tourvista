import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/tripadvisor': {
        target: 'https://api.content.tripadvisor.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tripadvisor/, ''),
        headers: {
          'Origin': 'https://developer-tripadvisor.com',
        },
      },
    },
  },
})
