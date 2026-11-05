<script setup lang="ts">
/** Monitor 验证码弹窗：自动识别失败时人工输入；验证码错误后端会返回新图片，弹窗保持打开 */
defineProps<{
  image: string
  reason: string
  loading: boolean
  submit: () => Promise<boolean>
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const code = defineModel<string>('code', { required: true })
</script>

<template>
  <a-modal v-model:visible="visible" title="Monitor 登录 · 输入验证码" :ok-loading="loading" ok-text="登录" :on-before-ok="submit">
    <a-alert v-if="reason" type="warning" class="captcha-reason">
      {{ reason }}
    </a-alert>
    <div class="captcha-row">
      <img v-if="image" :src="image" alt="验证码" class="captcha-img">
      <a-button size="small" :loading="loading" @click="emit('refresh')">
        换一张
      </a-button>
    </div>
    <a-input v-model="code" placeholder="验证码" allow-clear @press-enter="submit" />
  </a-modal>
</template>

<style scoped>
.captcha-reason { margin-bottom: 12px; }
.captcha-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.captcha-img { height: 40px; border: 1px solid var(--color-border-2); border-radius: 4px; }
</style>
