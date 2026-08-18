module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/mqtt/**",
    "!src/socket/**",
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  transformIgnorePatterns: [
    "/node_modules/(?!(dotenvx|@prisma|prisma)/)",
  ],
};
