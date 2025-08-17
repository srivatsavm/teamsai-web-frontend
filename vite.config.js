import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    icons: ['lucide-react']
                }
            }
        }
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'https://aidocumentassistantapp-dafkejambmdnejeh.australiaeast-01.azurewebsites.net',
                changeOrigin: true,
                secure: true
            }
        }
    }
})