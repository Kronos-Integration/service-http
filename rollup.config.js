import pkg from './package.json';

export default {
  plugins: [],
  external: ['model-attributes', 'kronos-service', 'kronos-endpoint'],
  input: pkg.module,

  output: {
    format: 'cjs',
    file: pkg.main
  }
};
