<script setup lang="ts">
/**
 * API 清单（基础配置 → 元数据管理）
 *
 * 页面主体在 components/ApiInventoryView.vue（与「API测试 → API概览」共用）：
 *   inventory 模式 = 本页（左树按维度过滤 + 环境同步 + 背景需求录入）；
 *   overview 模式 = API概览（同一张表追加 用例数/成功数/执行时间/状态 四列）。
 *
 * 这里只保留薄壳，保证路由 name 与菜单 path 一致（keep-alive 按它对上缓存）。
 */
import ApiInventoryView from './components/ApiInventoryView.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-inventory' })
</script>

<template>
  <ApiInventoryView mode="inventory" />
</template>
