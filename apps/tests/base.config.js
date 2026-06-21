module.exports = {
  BASE_CONFIG: {
    actionUrl: "http://localhost:3001/login",
    BASE_SERVER_URL: "http://localhost:3001",
    mode: "single",
    authType: "email-password",
    storageStatePath: ".auth",
    selectors: {
      emailOrUsernameField: "",
      passwordField: "",
      otpMultiFields: 'input[data-testid="otp-digit"]', 
      passwordSubmitButton: 'button[type="submit"]',
      googleOAuthButton: "#sso-btn",
    },
    users: [],
    deleteAuthStorageOnTestRun: false,
    rateLimited: false,
  },
};
