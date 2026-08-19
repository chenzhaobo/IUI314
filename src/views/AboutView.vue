<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useUserStore } from '@/stores'
import type { MessageSchema } from '@/i18n'

defineOptions({ name: 'Dashboard' })

const { t } = useI18n<{ message: MessageSchema }>({ useScope: 'global' })
const userStore = useUserStore()

// 展示名优先用昵称（扫码登录用户的账号是 kd_<金蝶uid>，不适合直接展示）
const nickName = computed(() => userStore.user.nickname || userStore.user.name || '')
</script>

<template>
  <div class="dashboard">
    <a-card>
      <template #title>
        <span>{{ t('app.title') }}</span>
      </template>
      <a-typography-title :heading="3">
        {{ t('app.hello') }}，{{ nickName }}
      </a-typography-title>
      <a-typography-paragraph type="secondary">
        欢迎
      </a-typography-paragraph>
    </a-card>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 16px;
}
</style>
