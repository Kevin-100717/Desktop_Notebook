
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import ElementPlus from 'unplugin-element-plus/vite'

export default defineConfig({
    plugins: [
        vue(),
        ElementPlus()
    ],
    base: './',
    server: {
        port: 5173,
        strictPort: true
    },
    manifest: true,
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    },
    optimizeDeps: {
        exclude: ['electron'],
    }
})

