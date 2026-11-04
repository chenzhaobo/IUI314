<script lang="ts" setup>
import { Message, Modal, type TableColumnData } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiSysOnlineUser } from '@/api/sysApis'
import { hasPermission, parseTime, useDelete, useTableAutoHeight } from '@/hooks'
import type { onlineUser } from '@/types/system/online-user'

defineOptions({ name: 'OnlineUserTable' })

const emits = defineEmits([
  'getList',
])

const tableData = defineModel<onlineUser[] | null>('tableData', { required: true })

const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

// 表格列属性
const columns = computed<TableColumnData[]>(() => [
  {
    title: '#',
    width: 30,
    align: 'center',
    render: ({ rowIndex }) => rowIndex + 1,
  },
  {
    title: '会话编号',
    dataIndex: 'id',
    align: 'center',
    width: 100,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: '所属部门',
    dataIndex: 'dept_name',
    align: 'center',
    width: 100,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: '网络',
    dataIndex: 'net',
    align: 'center',
    width: 100,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: 'IP',
    dataIndex: 'ipaddr',
    align: 'center',
    width: 120,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: '登录地点',
    dataIndex: 'login_location',
    ellipsis: true,
    tooltip: true,
    width: 180,
    align: 'center',
  },
  {
    title: '操作系统',
    dataIndex: 'os',
    width: 180,
    align: 'center',
  },
  {
    title: '浏览器',
    dataIndex: 'browser',
    ellipsis: true,
    tooltip: true,
    width: 120,
    align: 'center',
  },
  {
    title: '设备',
    dataIndex: 'device',
    width: 120,
    ellipsis: true,
    tooltip: true,
    align: 'center',
  },
  {
    title: '登录时间',
    width: 180,
    align: 'center',
    render: ({ record }) => parseTime(record.login_time),
  },
  {
    title: '最后活跃',
    width: 180,
    align: 'center',
    render: ({ record }) => record.last_access_time ? parseTime(record.last_access_time) : '未知',
  },
  {
    title: '活跃状态',
    slotName: 'activity',
    width: 120,
    align: 'center',
  },
  {
    title: '操作',
    slotName: 'operation',
    width: 100,
    fixed: 'right',
    align: 'center',
  },
])

/** 按最后活跃时间给出粗略状态，方便一眼区分「在用」和「挂着」 */
function activityTag(record: onlineUser) {
  const ts = record.last_access_time ? new Date(record.last_access_time).getTime() : Number.NaN
  if (Number.isNaN(ts))
    return { text: '未知', color: 'gray' }
  const idleMinutes = (Date.now() - ts) / 60000
  if (idleMinutes <= 5)
    return { text: '活跃', color: 'green' }
  if (idleMinutes <= 60)
    return { text: '空闲', color: 'orange' }
  return { text: '长时间未操作', color: 'red' }
}

function handleForceLogout(row?: onlineUser) {
  if (row) {
    Modal.warning({
      title: '确认清空',
      hideCancel: false,
      titleAlign: 'start',
      content: `是否确认强退用户 ${row?.user_name}?`,
      okText: '确认',
      cancelText: '取消',
      draggable: true,
      onOk: async () => {
        const ids = [row?.id]
        const { execute } = useDelete(ApiSysOnlineUser.delete, { ids })
        await execute()
        Message.success(`强退用户 ${row?.user_name} 成功!`)
        emits('getList')
      },
      onCancel: async () => Message.info('取消操作'),
    })
  }
  else {
    Message.info('用户不存在')
  }
}
</script>

<template>
  <div ref="tableWrap">
    <a-table
  column-resizable
    :columns="columns"
    :data="tableData || []"
    row-key="id"
    :scroll="{ minWidth: 800, y: tableHeight }"
    :pagination="false"
  >
    <template #activity="{ record }">
      <a-tag :color="activityTag(record).color" size="small">
        {{ activityTag(record).text }}
      </a-tag>
    </template>
    <template #operation="{ record }">
      <a-button
        v-if="hasPermission(ApiSysOnlineUser.delete)"
        type="text"
        shape="round"
        status="danger"
        @click="handleForceLogout(record)"
      >
        强制下线
        <template #icon>
          <IconDelete />
        </template>
      </a-button>
    </template>
  </a-table>
  </div>
</template>
