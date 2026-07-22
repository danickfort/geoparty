import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('@/views/PlayerView.vue') },
    { path: '/screen', component: () => import('@/views/ScreenView.vue') },
    { path: '/admin', component: () => import('@/views/AdminView.vue') },
    { path: '/scoreboard', component: () => import('@/views/ScoreboardView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFoundView.vue') },
  ],
})
