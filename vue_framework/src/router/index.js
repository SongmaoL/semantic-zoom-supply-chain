import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import FlowMap from '../pages/FlowMap.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/flow-map',
      name: 'FlowMap',
      component: FlowMap
    },
    // Legacy redirects for old URLs
    {
      path: '/arc-map',
      redirect: '/flow-map'
    },
    {
      path: '/semantic-zoom',
      redirect: '/flow-map'
    }
  ]
})

export default router
