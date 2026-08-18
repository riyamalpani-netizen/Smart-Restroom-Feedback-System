const { TEST_USER } = require("./authHelper");

beforeAll(async () => {
  global.testUser = TEST_USER;
});

afterAll(async () => {
  global.testUser = null;
});
