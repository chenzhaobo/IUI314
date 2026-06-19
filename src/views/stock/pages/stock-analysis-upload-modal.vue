<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiStockAmazon } from '@/api/stockApis'
import { usePost } from '@/hooks'

defineOptions({ name: 'StockAnalysisUploadModal' })

const emit = defineEmits(['success'])
const visible = defineModel<boolean>('visible', { required: true })

const selectedFile = ref<File | null>(null)
const fileName = ref('')
const loading = ref(false)

function beforeUpload(file: File) {
  selectedFile.value = file
  fileName.value = file.name
  return false
}

function handleRemove() {
  selectedFile.value = null
  fileName.value = ''
}

async function handleOk() {
  if (!selectedFile.value) {
    Message.warning('请选择要上传的报表文件')
    return false
  }
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  loading.value = true
  const { data, execute } = usePost<string>(ApiStockAmazon.upload, formData)
  await execute()
  loading.value = false
  if (data.value === ErrorFlag)
    return false
  Message.success(data.value || '上传成功')
  selectedFile.value = null
  fileName.value = ''
  emit('success')
  return true
}

function handleCancel() {
  selectedFile.value = null
  fileName.value = ''
  visible.value = false
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    title="上传 Amazon 报表"
    :ok-loading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form auto-label-width>
      <a-form-item label="报表文件" required>
        <a-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".txt,.tsv,.csv"
          @before-upload="beforeUpload"
        >
          <template #upload-button>
            <a-button>选择文件</a-button>
          </template>
        </a-upload>
        <a-tag v-if="fileName" closable color="arcoblue" class="m-l-8px" @close="handleRemove">
          {{ fileName }}
        </a-tag>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
