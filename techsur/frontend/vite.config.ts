import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/productos': 'http://localhost:8000',
      '/ventas': 'http://localhost:8000',
      '/clientes': 'http://localhost:8000',
      '/proveedores': 'http://localhost:8000',
      '/compras': 'http://localhost:8000',
      '/permutas': 'http://localhost:8000',
      '/historial': 'http://localhost:8000',
      '/ai': 'http://localhost:8000',
    },
  },
})
