<script setup lang="ts">
/**
 * API 概览（安全测试 → API测试 → API概览）
 *
 * 与「元数据管理 → API清单」是**同一张表两个菜单**：同一套页面组件，
 * 概览模式额外展示 用例数 / 成功数 / 执行时间 / 状态（回答「这个接口测过没有、最近一轮如何」）。
 * 主体在 views/metadata/components/ApiInventoryView.vue。
 */
import ApiInventoryView from '@/views/metadata/components/ApiInventoryView.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-overview' })
</script>

<template>
  <ApiInventoryView mode="overview" />
</template>
