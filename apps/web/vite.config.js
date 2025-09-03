import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development'
  
  return {
    plugins: [react()],
    build: {
      outDir: '../../public',
      emptyOutDir: true
    },
    define: {
      // API URL for backend calls - use local for development, production for build
      'import.meta.env.VITE_API_URL': JSON.stringify(
        isDev 
          ? 'http://localhost:8083'  // Local development
          : 'https://tv-api-326430627435.us-central1.run.app'  // Production
      ),
      // AI Service URL - use local for development, production for build
      'import.meta.env.VITE_AI_SERVICE_URL': JSON.stringify(
        isDev 
          ? 'http://localhost:8001'  // Local development
          : 'https://tv-ai-326430627435.us-central1.run.app'  // Production
      )
    }
  }
})
