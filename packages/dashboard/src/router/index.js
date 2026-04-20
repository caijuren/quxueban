import { createRouter, createWebHistory } from 'vue-router'
import Overview from '../views/Overview.vue'
import Testing from '../views/Testing.vue'

const routes = [
  {
    path: '/',
    name: 'Overview',
    component: Overview
  },
  {
    path: '/testing',
    name: 'Testing',
    component: Testing
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router