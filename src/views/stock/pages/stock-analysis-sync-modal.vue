<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiStockGiga } from '@/api/stockApis'
import { usePost } from '@/hooks'
import type { gigaSyncReq } from '@/types/stock/stock'

defineOptions({ name: 'StockAnalysisSyncModal' })

const emit = defineEmits(['success'])
const visible = defineModel<boolean>('visible', { required: true })

const form = ref<gigaSyncReq>({
  cookie: '',
})
const loading = ref(false)

async function handleOk() {
  if (!form.value.cookie.trim()) {
    Message.warning('请输入 Cookie')
    return false
  }
  loading.value = true
  const { data, execute } = usePost<string>(ApiStockGiga.sync, form)
  await execute()
  loading.value = false
  if (data.value === ErrorFlag)
    return false
  Message.success(data.value || '同步成功')
  form.value.cookie = ''
  emit('success')
  return true
}

function handleCancel() {
  form.value.cookie = ''
  visible.value = false
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    title="同步 GigaB2B 收藏夹"
    :ok-loading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form :model="form" auto-label-width>
      <a-form-item label="Cookie" field="cookie" required>
        <a-textarea
          v-model="form.cookie"
          placeholder="请粘贴 GigaB2B 的 Cookie 字符串"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          allow-clear
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
