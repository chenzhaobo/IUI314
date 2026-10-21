<script setup lang="ts">
/**
 * API安全测试 → 环境与账号。
 *
 * 与「基础配置 → 测试环境」共用同一张 sec_test_env 表、同一套页面组件；
 * 放在安全测试下是为了让 Agent 使用者不用跳菜单就能补三角色账号/应用凭据。
 * 本页不复制数据，也不会另建环境。
 */
import TestEnvPage from './test-env.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'sec-env-accounts' })
</script>

<template>
  <div>
    <a-alert type="info" style="margin-bottom: 12px">
      本页与「基础配置 → 测试环境」共用同一张测试环境表（sec_test_env），不是另一套环境数据。
      在这里补应用凭据和 ALL/LIM/NONE 账号；新增/编辑环境会同步出现在基础配置中。
    </a-alert>
    <TestEnvPage />
  </div>
</template>
