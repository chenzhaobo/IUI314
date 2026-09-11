<script setup lang="ts">
/**
 * 表单安全遍历 — 表单测试域视图
 *
 * 菜单：安全测试 → 表单安全遍历（sys_menu.path = form-scan，迁移
 * m20260912_000001_sechub_domain_menu）。
 * 页面主体复用 components/DomainScanView.vue（域视图：用例 + 最近结果 + 域摘要）。
 *
 * 范围说明：本页只看**表单域**用例（form_perm / form_inject）。
 * 任务的创建与执行仍在「安全扫描 → 扫描任务」（一个任务覆盖所有测试类型）。
 */
import DomainScanView from './components/DomainScanView.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'form-scan' })
</script>

<template>
  <DomainScanView domain="form" />
</template>
