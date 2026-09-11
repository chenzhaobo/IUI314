<script setup lang="ts">
/**
 * OpenAPI测试 — 接口测试域视图
 *
 * 菜单：安全测试 → OpenAPI测试（sys_menu.path = openapi-scan，迁移
 * m20260912_000001_sechub_domain_menu）。
 * 页面主体复用 components/DomainScanView.vue（域视图：用例 + 最近结果 + 域摘要）。
 *
 * 范围说明：本页只看**接口域**用例（openapi_perm / openapi_inject）：
 *   - v1/v2 自动用例：未鉴权访问（不带 token 应被拒）
 *   - v3 自动用例：纵向越权（NONE 角色应被拒）
 * 任务的创建与执行仍在「安全扫描 → 扫描任务」（测试类型勾选「OpenAPI测试」）。
 */
import DomainScanView from './components/DomainScanView.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'openapi-scan' })
</script>

<template>
  <DomainScanView domain="openapi" />
</template>
