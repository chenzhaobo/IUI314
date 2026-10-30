<script setup lang="ts">
/**
 * 详情抽屉「自测脚本」Tab：说明脚本用法（凭证全部来自环境变量）并触发鉴权下载。
 */
import { computed } from 'vue'

import { verifyScriptFilename } from '../../../composables/defectEvidenceRules'

const props = defineProps<{
  defectCode: string
  downloading: boolean
}>()

const emit = defineEmits<{ (e: 'download'): void }>()

const filename = computed(() => verifyScriptFilename(props.defectCode))
</script>

<template>
  <div class="script-tab">
    <p class="intro">
      脚本不含任何凭证，运行前设置环境变量 <code>KD_BASE_URL</code>、<code>KD_ACCOUNT_ID</code>、
      <code>KD_APP_ID</code>、<code>KD_APP_SECRET</code>、<code>KD_USER</code>，
      或直接设置 <code>KD_ACCESS_TOKEN</code> 跳过登录。
    </p>
    <p class="intro">
      执行 <code>python3 {{ filename }}</code>，输出 <code>RESULT: PASS</code> 表示已修复。
    </p>
    <a-button type="primary" :loading="downloading" @click="emit('download')">
      下载验证脚本
    </a-button>
  </div>
</template>

<style scoped>
.script-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.intro {
  margin: 0;
  color: var(--color-text-2);
  font-size: 13px;
  line-height: 1.7;
}
code {
  padding: 0 4px;
  background: var(--color-fill-2);
  border-radius: 3px;
}
</style>
