/**
 * Real integration test against a RUNNING Core Hub + a running Demo Subsystem.
 * Skipped automatically unless CORE_HUB_URL / DEMO_SUBSYSTEM_URL and demo credentials are set.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.integration-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testTimeout: 60000,
};
