import { createWebHashHistory, createRouter } from 'vue-router'

import NotePageView from '../views/NotePageView.vue'
import SettingsPageView from '../views/SettingsPageView.vue'
import StickyNotePage from '../views/StickyNotePage.vue'

const routes = [
  { path: '/', component: NotePageView },
  { path: '/settings', component: SettingsPageView },
  { path: '/sticky/:tid', component: StickyNotePage },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router