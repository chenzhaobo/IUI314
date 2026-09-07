import { defineStore } from 'pinia'

import { unref } from 'vue'
import type { dictData, dictUse } from '@/types/system/dict'
import { useGet } from '@/hooks'
import { ApiSysDictData } from '@/api/sysApis'

interface DictsStore {
  dicts: Record<string, dictUse[]>
}

export const useDictsStore = defineStore('dicts', {
  state: (): DictsStore => ({
    dicts: {},
  }),
  actions: {
    async getRemoteDict(dict_type: string) {
      const { data, execute } = useGet<dictData[]>(
        ApiSysDictData.getByType,
        { dict_type },
      )
      await execute()
      const dict_data = unref(data)
      // 原来直接 `dict_data.map(...)`，请求失败时抛
      // "(intermediate value)(...).map is not a function"。
      // 失败时 data.value 不是 null 而是错误哨兵字符串（见 useRequest 的
      // updateDataOnError：哨兵要能进 data.value，否则 postAction 一类的判定失效），
      // 所以判空不够，必须判是不是数组。
      //
      // 失败时**不写入缓存**：写空数组会被 getDict 当成"已取到"而永久返回空，
      // 页面上所有该字典的标签从此都显示不出来，直到刷新整个应用。
      if (!Array.isArray(dict_data))
        return []
      const it_data = dict_data.map(
        (data): dictUse => ({
          label: data.dict_label!,
          value: data.dict_value!,
          elTagType: data.list_class,
          elTagClass: data.css_class,
          status: data.status!,
        }),
      )
      this.dicts[dict_type] = it_data
      return it_data
    },
    async getDict(dict_type: string) {
      const dict = this.dicts[dict_type]
      if (dict)
        return dict
      return await this.getRemoteDict(dict_type)
    },
  },
})
