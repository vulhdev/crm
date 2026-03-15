/** @type {import('jest').Config} */
module.exports = {
  displayName: '@crm/types',
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/*.test.ts'],
  coverageDirectory: '../coverage',
};
