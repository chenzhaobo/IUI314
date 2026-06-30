import type { App } from 'vue'
import {
  type RouteRecordRaw,
  createRouter,
  createWebHashHistory,
} from 'vue-router'

import { FixedRoutes, InnerLink, Layout, REDIRECT_ROUTE_NAME } from './constant'
import { useRouterGuard } from '@/hooks'
import type { AppRouteRecordRaw } from '@/types/base/router'

//  固定路由
export const constantRoutes: AppRouteRecordRaw[] = [
  // ── 首页 ──
  {
    path: '',
    component: Layout,
    redirect: 'index',
    name: 'index',
    meta: { title: '首页', icon: 'dashboard', i18n: 'home' },
    children: [
      {
        path: '/index',
        component: () => import('@/views/AboutView.vue'),
        name: 'dashboard',
        meta: { title: '首页', icon: 'dashboard', i18n: 'home' },
      },
      {
        path: 'vue',
        component: InnerLink,
        name: 'vue',
        meta: {
          title: 'vue',
          icon: 'dashboard',
          link: 'https://cn.vuejs.org/',
          i18n: 'vue',
        },
      },
    ],
  },
  // ── KD-SecHub 安全测试平台 ──
  {
    path: '/sechub',
    component: Layout,
    name: 'SecHub',
    meta: { title: '安全测试', icon: 'dashboard', i18n: 'sechub' },
    children: [
      {
        path: 'scan-tool',
        component: () => import('@/views/sechub/scan-tool.vue'),
        name: 'SecScanTool',
        meta: { title: '扫描工具', icon: 'dashboard', i18n: 'secScanTool' },
      },
      {
        path: 'scan-run',
        component: () => import('@/views/sechub/scan-run.vue'),
        name: 'SecScanRun',
        meta: { title: '扫描运行', icon: 'dashboard', i18n: 'secScanRun' },
      },
      {
        path: 'scan-task',
        component: () => import('@/views/sechub/scan-task.vue'),
        name: 'SecScanTask',
        meta: { title: '扫描任务', icon: 'dashboard', i18n: 'secScanTask' },
      },
      {
        path: 'finding',
        component: () => import('@/views/sechub/finding.vue'),
        name: 'SecFinding',
        meta: { title: '安全发现', icon: 'dashboard', i18n: 'secFinding' },
      },
      {
        path: 'defect',
        component: () => import('@/views/sechub/defect.vue'),
        name: 'SecDefect',
        meta: { title: '缺陷跟踪', icon: 'dashboard', i18n: 'secDefect' },
      },
      {
        path: 'org',
        component: () => import('@/views/sechub/org.vue'),
        name: 'SecOrg',
        meta: { title: '组织管理', icon: 'dashboard', i18n: 'secOrg' },
      },
      {
        path: 'project-group',
        component: () => import('@/views/sechub/project-group.vue'),
        name: 'SecProjectGroup',
        meta: { title: '项目组', icon: 'dashboard', i18n: 'secProjectGroup' },
      },
      {
        path: 'release-window',
        component: () => import('@/views/sechub/release-window.vue'),
        name: 'SecReleaseWindow',
        meta: { title: '发布窗口', icon: 'dashboard', i18n: 'secReleaseWindow' },
      },
      {
        path: 'test-env',
        component: () => import('@/views/sechub/test-env.vue'),
        name: 'SecTestEnv',
        meta: { title: '测试环境', icon: 'dashboard', i18n: 'secTestEnv' },
      },
      {
        path: 'user-story',
        component: () => import('@/views/sechub/user-story.vue'),
        name: 'SecUserStory',
        meta: { title: '用户故事', icon: 'dashboard', i18n: 'secUserStory' },
      },
    ],
  },
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    name: REDIRECT_ROUTE_NAME,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/components/layout/redirect.vue'),
      },
    ],
  },
  // login
  {
    path: '/login',
    component: () => import('@/components/login/index.vue'),
    hidden: true,
    name: 'Login',
  },
]

export const router = createRouter({
  // history: createWebHistory(),
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [...constantRoutes, ...FixedRoutes] as Readonly<RouteRecordRaw[]>,
  scrollBehavior() {
    return { top: 0 }
  },
})

export async function setupRoutes(app: App) {
  app.use(router)
  await useRouterGuard(router)
  await router.isReady()
}
