import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { initTheme } from './utils/theme.js'
import 'element-plus/theme-chalk/dark/css-vars.css'

initTheme()

createApp(App).use(router).mount('#app')
