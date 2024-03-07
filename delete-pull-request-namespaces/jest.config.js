export default {
  preset: 'ts-jest',
  // preset: 'ts-jest/presets/js-with-babel-esm',
  // https://github.com/kulshekhar/ts-jest/issues/1057#issuecomment-1068342692
  moduleNameMapper: {
    '(.+)\\.js': '$1',
  },
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  verbose: true,
}
