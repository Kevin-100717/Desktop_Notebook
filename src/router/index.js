import { createMemoryHistory, createRouter } from 'vue-router'

import NotePageView from '../views/NotePageView.vue'
import SettingsPageView from '../views/SettingsPageView.vue'

const routes = [
  { path: '/', component: NotePageView },
  { path: '/settings', component: SettingsPageView },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router