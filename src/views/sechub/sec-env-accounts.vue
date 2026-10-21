<script setup lang="ts">
/**
 * API安全测试 → 环境与账号。
 *
 * 与「基础配置 → 测试环境」共用同一套页面（同一张 sec_test_env 表），
 * 放在安全测试下是为了让 Agent 使用者不用跳菜单就能补三角色账号/应用凭据。
 */
import TestEnvPage from './test-env.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'sec-env-accounts' })
</script>

<template>
  <TestEnvPage />
</template>
