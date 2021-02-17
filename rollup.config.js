import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import requireContext from 'rollup-plugin-require-context'
import { join } from 'path'
import { uglify } from 'rollup-plugin-uglify'
import babel from 'rollup-plugin-babel'
import deepmerge from 'deepmerge'

const name = 'shinput'

const baseConfig = {
  input: join(__dirname, 'source', 'index.js'),
  output: {
    name
  },
  name,
  plugins: [
    resolve({ jsnext: true }),
    commonjs({
      include: 'node_modules/**'
    }),
    babel({
      runtimeHelpers: true,
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env'],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            regenerator: true
          }
        ]
      ]
    }),
    uglify({
      sourcemap: false
    })
  ]
}

const branchConfigs = {
  browser: {
    output: {
      format: 'iife',
      file: join(__dirname, 'dist', 'Shinput-browser.min.js')
    }
  },
  node: {
    output: {
      format: 'cjs',
      file: join(__dirname, 'dist', 'Shinput-commonjs.js')
    }
  },
  universal: {
    output: {
      format: 'umd',
      file: join(__dirname, 'dist', 'Shinput-universal.min.js')
    }
  }
}

const configs = Object.values(branchConfigs).map(config => deepmerge(baseConfig, config))

configs[1].plugins.splice(0, 1) // Don't include dependencies in node bundle
configs[1].plugins.splice(2) // Don't Uglify the node bundle
export default configs
