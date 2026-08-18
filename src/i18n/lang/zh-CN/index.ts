// i18n 翻译已迁移到后端 sys_i18n 表，此文件不再使用
export {}
import app from './app.json'
import route from './route.json'
import sys from './sys.json'
import theme from './theme.json'

const zhCN = {
  app: { ...app },
  route: { ...route },
  sys: { ...sys },
  theme: { ...theme },
}

export default zhCN
