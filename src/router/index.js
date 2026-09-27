import { createWebHashHistory, createRouter } from 'vue-router'

import NotePageView from '../views/NotePageView.vue'
import SettingsPageView from '../views/SettingsPageView.vue'
import StickyNotePage from '../views/StickyNotePage.vue'
import TrashPageView from '../views/TrashPageView.vue'
import GraphPageView from '../views/GraphPageView.vue'

const routes = [
  { path: '/', component: NotePageView },
  { path: '/graph', component: GraphPageView },
  { path: '/trash', component: TrashPageView },
  { path: '/settings', component: SettingsPageView },
  { path: '/sticky/:tid', component: StickyNotePage },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router