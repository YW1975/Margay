import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  mode: isDevelopment ? 'development' : 'production',
  devtool: isDevelopment ? 'source-map' : false,
  // entry: "./src/index.ts",
  entry: {
    index: './src/index.ts',
    worker: './src/worker/index.ts',
    gemini: './src/worker/gemini.ts',
    acp: './src/worker/acp.ts',
    codex: './src/worker/codex.ts',
  },
  output: {
    filename: '[name].js',
    // path: path.resolve(__dirname, "../../main"),
  },
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@common': path.resolve(__dirname, '../../src/common'),
      '@renderer': path.resolve(__dirname, '../../src/renderer'),
      '@process': path.resolve(__dirname, '../../src/process'),
      '@worker': path.resolve(__dirname, '../../src/worker'),
      '@xterm/headless$': path.resolve(__dirname, '../../src/shims/xterm-headless.ts'),
    },
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'node-pty': 'commonjs node-pty',
    // tree-sitter 相关依赖需要作为外部模块，避免 webpack 处理 .wasm 文件
    // tree-sitter dependencies need to be external to avoid webpack processing .wasm files
    'tree-sitter': 'commonjs tree-sitter',
    'tree-sitter-bash': 'commonjs tree-sitter-bash',
    // web-tree-sitter 是 @margay/agent-core 的嵌套依赖
    // web-tree-sitter is a nested dependency of @margay/agent-core
    'web-tree-sitter': 'commonjs web-tree-sitter',
    // 处理 @margay/agent-core 中的 ?binary WASM 导入
    // Handle ?binary WASM imports from @margay/agent-core - let them fail so fallback can work
    'web-tree-sitter/tree-sitter.wasm?binary': 'commonjs web-tree-sitter/tree-sitter.wasm',
    'tree-sitter-bash/tree-sitter-bash.wasm?binary': 'commonjs tree-sitter-bash/tree-sitter-bash.wasm',
    // ajv/ajv-formats: @margay/agent-core 的 schemaValidator.js 是 ESM 但 ajv 是 CJS，
    // webpack ESM/CJS interop 会破坏 Ajv 构造函数的 opts.code 初始化。
    // 外部化后让 Node.js require() 原生处理 CJS 加载。
    // ajv/ajv-formats: schemaValidator.js (ESM) importing ajv (CJS) breaks under webpack
    // ESM/CJS interop — Ajv constructor opts.code becomes undefined. Externalize to use
    // native Node.js require() which handles this correctly.
    'ajv': 'commonjs ajv',
    'ajv/dist/2020.js': 'commonjs ajv/dist/2020.js',
    'ajv-formats': 'commonjs ajv-formats',
  },
};
