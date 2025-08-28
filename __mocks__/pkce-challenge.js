// Mock for pkce-challenge module to avoid ES module issues in Jest
const mockPkceChallenge = () => Promise.resolve({
  code_verifier: 'mock-code-verifier-12345678901234567890123456789012345678901234567890',
  code_challenge: 'mock-code-challenge-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMN',
});

module.exports = mockPkceChallenge;
module.exports.default = mockPkceChallenge;