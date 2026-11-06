import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr'
import path from 'path'

const srcAliases = ['backend', 'frontend', 'common'].map((aliasName) => ({
  find: aliasName,
  replacement: path.join(__dirname, 'src', aliasName)
}))

const dependenciesToNotExternalize = [
  '@xhmikosr/decompress',
  '@xhmikosr/decompress-targz',
  '@xhmikosr/decompress-unzip'
]

export default defineConfig(({ mode }) => ({
  main: {
    build: {
      rollupOptions: {
        input: 'src/backend/main.ts',
        output: {
          chunkFileNames: `chunks/[name].js`,
          assetFileNames: `chunks/[name].[ext]`
        }
      },
      outDir: 'build/main',
      minify: false,
      sourcemap: 'inline'
    },
    resolve: { alias: srcAliases },
    plugins: [externalizeDepsPlugin({ exclude: dependenciesToNotExternalize })]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts',
          webviewPreload: 'src/webviewPreload/index.ts',
          xbox: 'src/integrations/xbox/preload/index.ts',
          'xbox-auth': 'src/integrations/xbox/preload/auth.ts'
        },
        output: {
          chunkFileNames: `chunks/[name].js`,
          assetFileNames: `chunks/[name].[ext]`
        }
      },
      outDir: 'build/preload',
      minify: true,
      sourcemap: mode === 'development' ? 'inline' : false
    },
    resolve: { alias: srcAliases },
    plugins: [externalizeDepsPlugin({ exclude: dependenciesToNotExternalize })]
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          main: path.resolve('index.html'),
          xboxNative: path.resolve('xbox-native.html'),
          xboxOverlay: path.resolve('overlay.html')
        },
        output: {
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`
        }
      },
      target: 'esnext',
      outDir: 'build',
      emptyOutDir: false,
      minify: true,
      sourcemap: mode === 'development' ? 'inline' : false
    },
    resolve: { alias: srcAliases },
    plugins: [react(), svgr()]
  }
}))
