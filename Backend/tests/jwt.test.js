const { signToken, verifyToken } = require('../config/jwt');

describe('JWT', () => {
  test('sign and verify roundtrip', () => {
    const token = signToken(42);
    expect(typeof token).toBe('string');
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
  });
});
