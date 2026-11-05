<script setup lang="ts">
/** 流水线调用说明（可折叠）：触发 + 轮询 done，结束后再还原自动化环境数据库 */
import { PIPELINE_CURL } from '../types'
</script>

<template>
  <a-collapse :bordered="false" class="pipeline-help">
    <a-collapse-item key="pipeline" header="流水线调用说明">
      <div class="help-text">
        用只授予 monaudit/round/trigger 的专用用户生成个人访问令牌（ttp_pat_…），自动化执行完成后调用触发接口，
        轮询到 data.done=true 后再还原数据库。
      </div>
      <pre class="help-pre">{{ PIPELINE_CURL }}</pre>
    </a-collapse-item>
  </a-collapse>
</template>

<style scoped>
.pipeline-help { margin-top: 8px; }
.help-text { margin-bottom: 6px; color: var(--color-text-2); font-size: 13px; }
.help-pre {
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  font-size: 12px;
  white-space: pre;
  background: var(--color-fill-2);
  border-radius: 4px;
}
</style>
