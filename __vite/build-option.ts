import type { BuildOptions } from 'vite'

export function getBuild(): BuildOptions {
  return {
    sourcemap: false,
    minify: 'terser',
    outDir: './dist',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: (assetInfo: { name: string }) => {
          const name
                        = assetInfo.name.includes('.vue_vue_type_style_index_0_lang')
                        || assetInfo.name.includes('.vue_vue_type_script_setup_true_lang')
                        || assetInfo.name.includes('.vue_vue_type_script_setup_true_name')
                        || assetInfo.name.includes('.vue_vue_type_script_name')
                          ? assetInfo.name.split('.')[0]
                          : assetInfo.name
          return `assets/${name}-[hash].js`
        },
        // Vite 8 (rolldown) 仅支持 manualChunks 的函数形式，不再支持对象形式
        manualChunks: (id: string) => {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender'))
            return 'echarts'
          if (id.includes('node_modules/vue-i18n') || id.includes('node_modules/@intlify'))
            return 'vue-i18n'
          if (id.includes('node_modules/vue-router'))
            return 'vue-router'
          if (id.includes('virtual:svg-icons-register'))
            return 'svg-icon'
        },
      },
    },

    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      sourceMap: false,
      format: {
        comments: false,
      },
    },
  }
}
