import type { AppRouteRecordRaw } from '@/types/base/router'
import {
  PERF_COMPARISON_CREATE_PATH,
  PERF_COMPARISON_DETAIL_PATH,
  PERF_COMPARISON_REPORT_PATH,
  PERF_COVERAGE_DASHBOARD_PATH,
  PERF_COVERAGE_DETAIL_PATH,
} from '@/views/perf/routes'
import { Layout } from './constant'

/**
 * 性能测试「不占菜单」的隐藏页（新增比对 / 比对详情 / 覆盖率明细）。
 *
 * 这三页原来挂在 sys_menu 上（visible=0 的隐藏菜单），菜单重组后不再有菜单项，
 * 若不注册路由，从列表页跳过去会落到 404 —— 所以改由前端静态路由承接。
 *
 * 两条约束：
 * 1. 必须套 Layout 才能带侧栏（同 constant.ts 里 /cloud-perf/compliance 的写法）；
 * 2. 子路由写绝对路径，URL 与菜单页同级；父级 path 特意取菜单里不存在的段，
 *    避免与菜单页同 path 撞车（同 path 的记录谁先注册谁生效，静态路由注册在前）。
 */
export const PerfStaticRoutes: AppRouteRecordRaw[] = [
  {
    path: '/perf/static-pages',
    component: Layout,
    hidden: true,
    children: [
      // 组件名与路由 name 一致，keep-alive 的 :include 才能命中（当前 no_cache，先对齐约定）
      {
        path: PERF_COMPARISON_CREATE_PATH,
        name: 'comparison-create',
        component: () => import('@/views/perf/comparison-create.vue'),
        meta: {
          title: '新增比对',
          icon: 'dict',
          activeMenu: PERF_COMPARISON_REPORT_PATH,
          no_cache: true,
        },
      },
      {
        path: PERF_COMPARISON_DETAIL_PATH,
        name: 'comparison-detail',
        component: () => import('@/views/perf/comparison-detail.vue'),
        meta: {
          title: '比对详情',
          icon: 'dict',
          activeMenu: PERF_COMPARISON_REPORT_PATH,
          no_cache: true,
        },
      },
      {
        path: PERF_COVERAGE_DETAIL_PATH,
        name: 'coverage-detail',
        component: () => import('@/views/perf/coverage/CoverageDetail.vue'),
        meta: {
          title: '覆盖率明细',
          icon: 'dict',
          activeMenu: PERF_COVERAGE_DASHBOARD_PATH,
          no_cache: true,
        },
      },
    ],
  },
]
