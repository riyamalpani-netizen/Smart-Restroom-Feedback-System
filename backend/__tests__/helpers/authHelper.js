const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { JWT_SECRET } = require("../../src/config/env");

const TEST_USER = {
  id: "test-user-id-123",
  name: "Test Admin",
  email: "test@example.com",
  password: bcrypt.hashSync("testpassword123", 10),
  role: "super_admin",
  organizationId: "test-org-id-123",
  active: true,
};

function generateTestToken(user = TEST_USER) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function getAuthHeader(user = TEST_USER) {
  return `Bearer ${generateTestToken(user)}`;
}

function getMockReq(user = TEST_USER, body = {}, params = {}, query = {}) {
  return {
    user,
    body,
    params,
    query,
    headers: {
      authorization: getAuthHeader(user),
    },
  };
}

module.exports = {
  TEST_USER,
  generateTestToken,
  getAuthHeader,
  getMockReq,
};
