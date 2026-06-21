"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/dotenv/package.json
var require_package = __commonJS({
  "../../node_modules/dotenv/package.json"(exports2, module2) {
    module2.exports = {
      name: "dotenv",
      version: "16.6.1",
      description: "Loads environment variables from .env file",
      main: "lib/main.js",
      types: "lib/main.d.ts",
      exports: {
        ".": {
          types: "./lib/main.d.ts",
          require: "./lib/main.js",
          default: "./lib/main.js"
        },
        "./config": "./config.js",
        "./config.js": "./config.js",
        "./lib/env-options": "./lib/env-options.js",
        "./lib/env-options.js": "./lib/env-options.js",
        "./lib/cli-options": "./lib/cli-options.js",
        "./lib/cli-options.js": "./lib/cli-options.js",
        "./package.json": "./package.json"
      },
      scripts: {
        "dts-check": "tsc --project tests/types/tsconfig.json",
        lint: "standard",
        pretest: "npm run lint && npm run dts-check",
        test: "tap run --allow-empty-coverage --disable-coverage --timeout=60000",
        "test:coverage": "tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
        prerelease: "npm test",
        release: "standard-version"
      },
      repository: {
        type: "git",
        url: "git://github.com/motdotla/dotenv.git"
      },
      homepage: "https://github.com/motdotla/dotenv#readme",
      funding: "https://dotenvx.com",
      keywords: [
        "dotenv",
        "env",
        ".env",
        "environment",
        "variables",
        "config",
        "settings"
      ],
      readmeFilename: "README.md",
      license: "BSD-2-Clause",
      devDependencies: {
        "@types/node": "^18.11.3",
        decache: "^4.6.2",
        sinon: "^14.0.1",
        standard: "^17.0.0",
        "standard-version": "^9.5.0",
        tap: "^19.2.0",
        typescript: "^4.8.4"
      },
      engines: {
        node: ">=12"
      },
      browser: {
        fs: false
      }
    };
  }
});

// ../../node_modules/dotenv/lib/main.js
var require_main = __commonJS({
  "../../node_modules/dotenv/lib/main.js"(exports2, module2) {
    "use strict";
    var fs7 = require("fs");
    var path5 = require("path");
    var os = require("os");
    var crypto = require("crypto");
    var packageJson = require_package();
    var version = packageJson.version;
    var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
    function parse(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/mg, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++) {
        try {
          const key = keys[i].trim();
          const attrs = _instructions(result, key);
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) {
            throw error;
          }
        }
      }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.log(`[dotenv@${version}][WARN] ${message}`);
    }
    function _debug(message) {
      console.log(`[dotenv@${version}][DEBUG] ${message}`);
    }
    function _log(message) {
      console.log(`[dotenv@${version}] ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
        return options.DOTENV_KEY;
      }
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
        return process.env.DOTENV_KEY;
      }
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = new Error("INVALID_DOTENV_KEY: Missing key part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return { ciphertext, key };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0) {
        if (Array.isArray(options.path)) {
          for (const filepath of options.path) {
            if (fs7.existsSync(filepath)) {
              possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
            }
          }
        } else {
          possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
        }
      } else {
        possibleVaultPath = path5.resolve(process.cwd(), ".env.vault");
      }
      if (fs7.existsSync(possibleVaultPath)) {
        return possibleVaultPath;
      }
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~" ? path5.join(os.homedir(), envPath.slice(1)) : envPath;
    }
    function _configVault(options) {
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (debug || !quiet) {
        _log("Loading env from encrypted .env.vault");
      }
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path5.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (options && options.encoding) {
        encoding = options.encoding;
      } else {
        if (debug) {
          _debug("No encoding is specified. UTF-8 is used by default");
        }
      }
      let optionPaths = [dotenvPath];
      if (options && options.path) {
        if (!Array.isArray(options.path)) {
          optionPaths = [_resolveHome(options.path)];
        } else {
          optionPaths = [];
          for (const filepath of options.path) {
            optionPaths.push(_resolveHome(filepath));
          }
        }
      }
      let lastError;
      const parsedAll = {};
      for (const path6 of optionPaths) {
        try {
          const parsed = DotenvModule.parse(fs7.readFileSync(path6, { encoding }));
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${path6} ${e.message}`);
          }
          lastError = e;
        }
      }
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsedAll, options);
      if (debug || !quiet) {
        const keysCount = Object.keys(parsedAll).length;
        const shortPaths = [];
        for (const filePath of optionPaths) {
          try {
            const relative = path5.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) {
              _debug(`Failed to load ${filePath} ${e.message}`);
            }
            lastError = e;
          }
        }
        _log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
      }
      if (lastError) {
        return { parsed: parsedAll, error: lastError };
      } else {
        return { parsed: parsedAll };
      }
    }
    function config2(options) {
      if (_dotenvKey(options).length === 0) {
        return DotenvModule.configDotenv(options);
      }
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else {
          throw error;
        }
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      if (typeof parsed !== "object") {
        const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed)) {
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
          }
          if (debug) {
            if (override === true) {
              _debug(`"${key}" is already defined and WAS overwritten`);
            } else {
              _debug(`"${key}" is already defined and was NOT overwritten`);
            }
          }
        } else {
          processEnv[key] = parsed[key];
        }
      }
    }
    var DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config: config2,
      decrypt,
      parse,
      populate
    };
    module2.exports.configDotenv = DotenvModule.configDotenv;
    module2.exports._configVault = DotenvModule._configVault;
    module2.exports._parseVault = DotenvModule._parseVault;
    module2.exports.config = DotenvModule.config;
    module2.exports.decrypt = DotenvModule.decrypt;
    module2.exports.parse = DotenvModule.parse;
    module2.exports.populate = DotenvModule.populate;
    module2.exports = DotenvModule;
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthFactory: () => AuthFactory,
  AuthManager: () => AuthManager,
  AuthPage: () => AuthPage,
  AuthReporter: () => AuthReporter,
  ConfigValidationError: () => ConfigValidationError,
  EmailOTPStrategy: () => EmailOTPStrategy,
  EmailPasswordOTPStrategy: () => EmailPasswordOTPStrategy,
  EmailPasswordStrategy: () => EmailPasswordStrategy,
  OAuthStrategy: () => OAuthStrategy,
  OIDCStrategy: () => OIDCStrategy,
  SAMLStrategy: () => SAMLStrategy,
  authConfig: () => authConfig,
  authEvents: () => authEvents,
  authFile: () => authFile,
  buildApiUrl: () => buildApiUrl,
  deleteAuthStore: () => deleteAuthStore,
  ensureValidSession: () => ensureValidSession,
  expect: () => import_test2.expect,
  extractToken: () => extractToken,
  getOrCreateAuthManager: () => getOrCreateAuthManager,
  getTokenFromFile: () => getTokenFromFile,
  isTokenExpired: () => isTokenExpired,
  test: () => test,
  validateConfig: () => validateConfig,
  validateUserEndpoints: () => validateUserEndpoints
});
module.exports = __toCommonJS(index_exports);

// src/pages/AuthPage.ts
var DEFAULTS = {
  emailOrUsernameField: "[data-testid='email']",
  passwordField: "[data-testid='password']",
  otpHiddenField: "input[autocomplete='one-time-code']",
  otpSingleField: "[data-testid='otp']",
  otpMultiFields: "[data-testid='otp-field']",
  emailSubmitButton: "button[type='submit']",
  passwordSubmitButton: "button[type='submit']",
  otpSubmitButton: "button[id='submit-btn']",
  googleOAuthButton: "button:has-text('Continue with Google')",
  microsoftOAuthButton: "button:has-text('Continue with Microsoft')",
  githubOAuthButton: "button:has-text('Continue with Github')",
  linkedInOAuthButton: "button:has-text('Continue with LinkedIn')",
  facebookOAuthButton: "button:has-text('Continue with Facebook')",
  ssoButton: "#sso-btn"
};
var AuthPage = class {
  constructor(page, overrides = {}) {
    this.page = page;
    this.overrides = overrides;
  }
  sel(key) {
    return this.overrides[key]?.trim() || DEFAULTS[key];
  }
  emailOrUsernameField() {
    return this.page.locator(this.sel("emailOrUsernameField"));
  }
  passwordField() {
    return this.page.locator(this.sel("passwordField"));
  }
  otpSingleField(strategy = "single-input") {
    if (strategy === "hidden-input") {
      return this.page.locator(this.sel("otpHiddenField"));
    }
    return this.page.locator(this.sel("otpSingleField"));
  }
  otpMultiFields() {
    return this.page.locator(this.sel("otpMultiFields"));
  }
  emailSubmitButton() {
    return this.page.locator(this.sel("emailSubmitButton"));
  }
  passwordSubmitButton() {
    return this.page.locator(this.sel("passwordSubmitButton"));
  }
  otpSubmitButton() {
    return this.page.locator(this.sel("otpSubmitButton"));
  }
  oauthButton(provider) {
    return this.page.locator(
      this.sel(`${provider}OAuthButton`)
    );
  }
  ssoButton() {
    return this.page.locator(this.sel("ssoButton"));
  }
  async fillEmail(email) {
    await this.emailOrUsernameField().fill(email);
  }
  async fillPassword(password) {
    await this.passwordField().fill(password);
  }
  async fillOTP(otp, strategy = "single-input", fieldCount = 1) {
    switch (strategy) {
      case "hidden-input": {
        const hidden = this.otpSingleField("hidden-input");
        await hidden.waitFor({ state: "attached" });
        await hidden.pressSequentially(otp, { delay: 50 });
        return;
      }
      case "multi-input": {
        return this.fillOTPMulti(otp, fieldCount);
      }
      case "single-input":
      default: {
        return this.fillOTPSingle(otp);
      }
    }
  }
  async fillOTPSingle(otp) {
    await this.otpSingleField("single-input").fill(otp);
  }
  async fillOTPMulti(otp, fieldCount = 6) {
    const digits = otp.split("").slice(0, fieldCount);
    const fields = this.otpMultiFields();
    for (let i = 0; i < digits.length; i++) {
      const input = fields.nth(i);
      await input.waitFor({ state: "visible" });
      await input.click();
      await input.fill(digits[i]);
      const nextInput = fields.nth(i + 1);
      const nextVisible = i + 1 < digits.length ? await nextInput.isVisible().catch(() => false) : false;
      if (nextVisible) {
        const isFocused = await nextInput.evaluate(
          (el) => el === document.activeElement
        ).catch(() => false);
        if (!isFocused) {
          await input.press("Tab");
        }
      }
    }
  }
  async submitEmail() {
    await this.emailSubmitButton().click();
  }
  async submitPassword() {
    await this.passwordSubmitButton().click();
  }
  async submitOTP() {
    await this.otpSubmitButton().click();
  }
  async waitForOTPInline(strategy = "single-input") {
    if (strategy === "multi-input") {
      await this.otpMultiFields().first().waitFor({ state: "visible" });
    } else {
      const state = strategy === "hidden-input" ? "attached" : "visible";
      await this.otpSingleField(strategy).waitFor({ state });
    }
  }
  async waitForOTPPage(urlPattern) {
    await this.page.waitForURL(urlPattern);
  }
  async waitForOTPMultiField() {
    await this.otpMultiFields().first().waitFor({ state: "visible" });
  }
};

// src/utils/helpers.ts
var import_promises2 = __toESM(require("fs/promises"));

// src/configs/_auth.config.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var dotenv = __toESM(require_main());
dotenv.config();
function findProjectRoot(startDir = process.cwd()) {
  let dir = import_path.default.resolve(startDir);
  while (true) {
    const pkg = import_path.default.join(dir, "package.json");
    if (import_fs.default.existsSync(pkg)) {
      return dir;
    }
    const parent = import_path.default.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `[auth-config] Cannot locate project root (no package.json found above "${startDir}")`
      );
    }
    dir = parent;
  }
}
function registerTsNode(projectRoot) {
  const tsNodeModule = require.resolve("ts-node", {
    paths: [projectRoot]
  });
  try {
    require(tsNodeModule).register({
      transpileOnly: true,
      files: false,
      compilerOptions: {
        module: "commonjs"
      }
    });
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to register ts-node.
${err.message}`
    );
  }
}
function loadAuthConfigFile(projectRoot) {
  const tsPath = import_path.default.join(projectRoot, "base.config.ts");
  const jsPath = import_path.default.join(projectRoot, "base.config.js");
  const configPath = import_fs.default.existsSync(tsPath) ? tsPath : import_fs.default.existsSync(jsPath) ? jsPath : null;
  if (!configPath) {
    throw new Error(
      `[auth-config] Missing base.config.ts or base.config.js in project root.
Expected: ${tsPath}`
    );
  }
  if (configPath.endsWith(".ts")) {
    registerTsNode(projectRoot);
  }
  let mod;
  try {
    mod = require(configPath);
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to load config: "${configPath}"
${err.message}`
    );
  }
  const config2 = mod?.default ?? mod?.BASE_CONFIG ?? mod;
  if (!config2 || typeof config2 !== "object") {
    throw new Error(
      `[auth-config] Invalid config export in "${configPath}".
Expected: export const BASE_CONFIG or export default`
    );
  }
  return config2;
}
function loadJsonFile(filePath) {
  if (!import_fs.default.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = import_fs.default.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Users JSON must be an array");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to parse users JSON: "${filePath}"
${err.message}`
    );
  }
}
async function createAuthConfig(usersPath) {
  if (!usersPath) {
    throw new Error("[auth-config] usersPath is required");
  }
  const projectRoot = findProjectRoot();
  const config2 = loadAuthConfigFile(projectRoot);
  const absoluteUsersPath = import_path.default.resolve(projectRoot, usersPath);
  const users = loadJsonFile(absoluteUsersPath);
  if (process.env.VALIDATE_USER_URLS === "1") {
    await validateUserEndpoints(users);
  }
  return {
    ...config2,
    users
  };
}

// src/core/AuthFactory.ts
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));

// src/core/AuthEvents.ts
var import_events = require("events");
var AuthEventEmitter = class extends import_events.EventEmitter {
  emit(event, ...args) {
    return super.emit(event, ...args);
  }
  on(event, listener) {
    return super.on(event, listener);
  }
  once(event, listener) {
    return super.once(event, listener);
  }
  off(event, listener) {
    return super.off(event, listener);
  }
};
var authEvents = new AuthEventEmitter();

// src/core/AuthFactory.ts
var AuthFactory = class {
  getStrategy(config2) {
    if (config2.customStrategy) return config2.customStrategy;
    switch (config2.authType) {
      case "email-password":
        return new EmailPasswordStrategy();
      case "email-password-otp":
        return new EmailPasswordOTPStrategy();
      case "email-otp":
        return new EmailOTPStrategy();
      case "oauth":
        return new OAuthStrategy();
      case "oidc":
        return new OIDCStrategy();
      case "saml":
        return new SAMLStrategy();
      default:
        throw new Error(`Unsupported auth type: ${config2.authType}`);
    }
  }
  async createSession(browser, user, strategy, config2) {
    return strategy.authenticate(browser, user, config2);
  }
  async saveSession(context, filePath, metadata = {}) {
    import_fs2.default.mkdirSync(import_path2.default.dirname(filePath), { recursive: true });
    await context.storageState({ path: filePath });
    const sessionStorageByOrigin = {};
    for (const page of context.pages()) {
      let origin;
      try {
        origin = new URL(page.url()).origin;
      } catch {
        continue;
      }
      if (!origin || origin === "null") continue;
      const dump = await page.evaluate(() => JSON.stringify(sessionStorage)).catch(() => "{}");
      const parsed = JSON.parse(dump || "{}");
      if (Object.keys(parsed).length) {
        sessionStorageByOrigin[origin] = {
          ...sessionStorageByOrigin[origin],
          ...parsed
        };
      }
    }
    const raw = import_fs2.default.readFileSync(filePath, "utf-8");
    const state = JSON.parse(raw);
    const enriched = {
      ...state,
      sessionStorage: Object.keys(sessionStorageByOrigin).length ? sessionStorageByOrigin : state.sessionStorage,
      metadata: {
        ...state.metadata,
        ...metadata,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    import_fs2.default.writeFileSync(filePath, JSON.stringify(enriched, null, 2), "utf-8");
    const payload = {
      filePath,
      enriched,
      userId: metadata.userId,
      authType: metadata.authType,
      savedAt: enriched.metadata.savedAt
    };
    authEvents.emit("session:saved", payload);
  }
  readSession(filePath) {
    if (!import_fs2.default.existsSync(filePath)) return null;
    try {
      const raw = import_fs2.default.readFileSync(filePath, "utf-8");
      const state = JSON.parse(raw);
      return state;
    } catch {
      return null;
    }
  }
  async restoreSessionStorage(context, state) {
    if (!state.sessionStorage || Object.keys(state.sessionStorage).length === 0)
      return;
    await context.addInitScript(
      (storageByOrigin) => {
        const entries = storageByOrigin[window.location.origin];
        if (!entries) return;
        for (const [key, value] of Object.entries(entries)) {
          window.sessionStorage.setItem(key, value);
        }
      },
      state.sessionStorage
    );
  }
  deleteSession(filePath) {
    if (!import_fs2.default.existsSync(filePath)) return;
    import_fs2.default.unlinkSync(filePath);
    authEvents.emit("session:deleted", { filePath });
  }
};

// src/core/AuthManager.ts
var import_fs4 = __toESM(require("fs"));

// src/utils/tokenStorage.ts
var import_fs3 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
function resolvePath(obj, dotPath) {
  const parts = dotPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === void 0 || typeof current !== "object") {
      return null;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}
function extractFromLocalStorage(state, origin, key, tokenPath) {
  const originEntry = state.origins.find((o) => o.origin === origin);
  if (!originEntry) return null;
  const entry = originEntry.localStorage.find((e) => e.name === key);
  if (!entry) return null;
  if (!tokenPath) return entry.value;
  try {
    return resolvePath(JSON.parse(entry.value), tokenPath);
  } catch {
    return entry.value;
  }
}
function extractFromSessionStorage(state, origin, key, tokenPath) {
  if (!state.sessionStorage) return null;
  const originEntries = state.sessionStorage[origin];
  if (!originEntries) return null;
  const value = originEntries[key];
  if (!value) return null;
  if (!tokenPath) return value;
  try {
    return resolvePath(JSON.parse(value), tokenPath);
  } catch {
    return value;
  }
}
function extractToken(state, config2, fallbackOrigin) {
  const origin = config2.origin ?? fallbackOrigin;
  if (!origin) return null;
  if (config2.storageType === "localStorage") {
    return extractFromLocalStorage(
      state,
      origin,
      config2.storageKey,
      config2.tokenPath
    );
  }
  return extractFromSessionStorage(
    state,
    origin,
    config2.storageKey,
    config2.tokenPath
  );
}
function getTokenFromFile(username, storageStatePath, config2, fallbackOrigin) {
  const filePath = import_path3.default.join(storageStatePath, `${username}.json`);
  if (!import_fs3.default.existsSync(filePath)) return null;
  try {
    const raw = import_fs3.default.readFileSync(filePath, "utf-8");
    const state = JSON.parse(raw);
    return extractToken(state, config2, fallbackOrigin);
  } catch {
    return null;
  }
}

// src/core/AuthManager.ts
var AuthManager = class {
  constructor(config2) {
    this.config = config2;
    this.userContexts = /* @__PURE__ */ new Map();
    this.factory = new AuthFactory();
  }
  buildEffectiveConfig(user) {
    return {
      ...this.config,
      authType: user.authType ?? this.config.authType,
      authPageLayout: user.authPageLayout ?? this.config.authPageLayout,
      isApi: user.isApi ?? this.config.isApi,
      otpConfig: user.otpConfig ?? this.config.otpConfig,
      apiConfig: user.apiConfig ?? this.config.apiConfig,
      actionUrl: user.actionUrl ?? this.config.actionUrl
    };
  }
  async authenticateWithRetry(browser, user, effectiveConfig, maxRetries = 2) {
    const strategy = this.factory.getStrategy(effectiveConfig);
    let lastError;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await strategy.authenticate(browser, user, effectiveConfig);
      } catch (error) {
        lastError = error;
        if (attempt > maxRetries) {
          break;
        }
        console.warn(
          `[Auth Retry ${attempt}/${maxRetries}] Failed for ${user.username}`
        );
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
    throw lastError;
  }
  async authenticateUser(browser, user) {
    const effectiveConfig = this.buildEffectiveConfig(user);
    const { context, metadata } = await this.authenticateWithRetry(
      browser,
      user,
      effectiveConfig,
      this.config.maxAuthRetries ?? 2
    );
    await this.factory.saveSession(
      context,
      `${this.config.storageStatePath}/${user.username}.json`,
      metadata ?? {}
    );
    return context;
  }
  async setup(browser) {
    this.browser = browser;
    if (!this.config.users.length) {
      throw new Error("At least one user must be configured");
    }
    const authenticate = async (user) => {
      const context = await this.authenticateUser(browser, user);
      this.userContexts.set(user.username, context);
      await context.close();
    };
    if (this.config.rateLimited) {
      for (const user of this.config.users) {
        await authenticate(user);
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      await Promise.all(this.config.users.map(authenticate));
    }
  }
  async reauthenticateUser(username, browser) {
    const user = this.config.users.find((u) => u.username === username);
    if (!user) {
      throw new Error(`User "${username}" not found`);
    }
    const existing = this.userContexts.get(username);
    if (existing) {
      await existing.close();
      this.userContexts.delete(username);
    }
    this.factory.deleteSession(
      `${this.config.storageStatePath}/${username}.json`
    );
    const context = await this.authenticateUser(browser, user);
    this.userContexts.set(username, context);
    return context;
  }
  async getContext(username, browser) {
    const storagePath = `${this.config.storageStatePath}/${username}.json`;
    if (!import_fs4.default.existsSync(storagePath)) {
      return browser.newContext();
    }
    let state = null;
    try {
      const raw = import_fs4.default.readFileSync(storagePath, "utf-8");
      state = JSON.parse(raw);
    } catch {
      return browser.newContext();
    }
    const user = this.config.users.find((u) => u.username === username);
    const tokenStorage = user?.tokenStorageConfig ?? this.config.tokenStorageConfig ?? null;
    if (tokenStorage && state) {
      const token = extractToken(
        state,
        tokenStorage,
        this.config.BASE_SERVER_URL
      );
      if (token) {
        const headerName = tokenStorage.headerName?.trim() ?? "Authorization";
        const attachBearer = tokenStorage.attachBearer ?? true;
        const isAuthorization = headerName.toLowerCase() === "authorization";
        const context2 = await browser.newContext({
          storageState: storagePath,
          extraHTTPHeaders: {
            [headerName]: isAuthorization && attachBearer ? `Bearer ${token}` : token
          }
        });
        await this.factory.restoreSessionStorage(context2, state);
        return context2;
      }
    }
    const context = await browser.newContext({ storageState: storagePath });
    if (state) await this.factory.restoreSessionStorage(context, state);
    return context;
  }
  get authConfig() {
    return this.config;
  }
  getUserEffectiveConfig(username) {
    const user = this.config.users.find((u) => u.username === username);
    if (!user) return this.config;
    return this.buildEffectiveConfig(user);
  }
  async readSession(username) {
    const context = this.userContexts.get(username);
    if (context) {
      await context.close();
      this.userContexts.delete(username);
    }
    const filePath = `${this.config.storageStatePath}/${username}.json`;
    let state = await this.factory.readSession(filePath);
    if (!state) {
      throw new Error(
        `[AuthManager] Session file missing or unreadable for "${username}" at "${filePath}". Run global setup first or add the user to users.json.`
      );
    }
    const isExpired = isTokenExpired(state);
    if (isExpired) {
      await this.reauthenticateUser(username, this.browser);
      state = await this.factory.readSession(filePath);
      if (!state) {
        throw new Error(`Reauthentication failed for "${username}"`);
      }
    }
    authEvents.emit("session:read", { filePath, state });
    return state;
  }
  async logoutSession(username) {
    const context = this.userContexts.get(username);
    if (context) {
      await context.close();
      this.userContexts.delete(username);
    }
    const filePath = `${this.config.storageStatePath}/${username}.json`;
    this.factory.deleteSession(filePath);
  }
  async teardown() {
    const entries = Array.from(this.userContexts.entries());
    await Promise.all(
      entries.map(async ([username, context]) => {
        try {
          await context.close();
          await this.logoutSession(username);
          console.log(`[Teardown] Closed context for ${username}`);
        } catch (err) {
          console.error(`[Teardown] Failed for ${username}`, err);
        }
      })
    );
    this.userContexts.clear();
  }
};

// src/core/AuthManagerInstance.ts
var import_path4 = __toESM(require("path"));
var import_promises = __toESM(require("fs/promises"));

// src/configs/ConfigValidationError.ts
var RESET = "\x1B[0m";
var RED = "\x1B[31m";
var YELLOW = "\x1B[33m";
var CYAN = "\x1B[36m";
var DIM = "\x1B[2m";
var BOLD = "\x1B[1m";
function formatIssue(issue, index) {
  const colour = issue.level === "error" ? RED : YELLOW;
  const tag = issue.level === "error" ? "\u2716 ERROR" : "\u26A0 WARNING";
  const counter = `[${index + 1}]`;
  const lines = [
    `  ${colour}${BOLD}${counter} ${tag}${RESET}  ${DIM}(${issue.code})${RESET}`,
    `     ${BOLD}Field  :${RESET} ${CYAN}${issue.field}${RESET}`,
    `     ${BOLD}Problem:${RESET} ${issue.message}`
  ];
  if (issue.hint) {
    lines.push(`     ${BOLD}Fix    :${RESET} ${DIM}${issue.hint}${RESET}`);
  }
  if (issue.user) {
    lines.push(`     ${BOLD}User   :${RESET} ${DIM}${issue.user}${RESET}`);
  }
  return lines.join("\n");
}
var ConfigValidationError = class _ConfigValidationError extends Error {
  constructor(issues) {
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");
    const header = [
      "",
      `${RED}${BOLD}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${RESET}`,
      `${RED}${BOLD}\u2551         PWMAF \u2014 Config Validation Failed                 \u2551${RESET}`,
      `${RED}${BOLD}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${RESET}`,
      "",
      `  Found ${RED}${BOLD}${errors.length} error(s)${RESET} and ${YELLOW}${warnings.length} warning(s)${RESET}.`,
      `  Errors must be fixed before global setup will run.`,
      `  Warnings will not block setup but may cause subtle test failures.`,
      ""
    ].join("\n");
    const errorSection = errors.length > 0 ? [
      `  ${RED}${BOLD}\u2500\u2500 Errors \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`,
      "",
      ...errors.map((issue, i) => formatIssue(issue, i)),
      ""
    ].join("\n") : "";
    const warnSection = warnings.length > 0 ? [
      `  ${YELLOW}${BOLD}\u2500\u2500 Warnings${RESET}`,
      "",
      ...warnings.map(
        (issue, i) => formatIssue(issue, errors.length + i)
      ),
      ""
    ].join("\n") : "";
    const footer = [
      `  ${DIM}Config file : base.config.ts${RESET}`,
      `  ${DIM}Users file  : src/data/users.json (or AUTH_USERS_FILE env var)${RESET}`,
      ""
    ].join("\n");
    super([header, errorSection, warnSection, footer].join("\n"));
    this.name = "ConfigValidationError";
    this.errors = errors;
    this.warnings = warnings;
    this.allIssues = issues;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _ConfigValidationError);
    }
  }
};

// src/configs/validate-config.ts
var VALID_AUTH_TYPES = /* @__PURE__ */ new Set([
  "email-password",
  "email-otp",
  "email-password-otp",
  "oauth",
  "oidc",
  "saml",
  "custom"
]);
var VALID_AUTH_MODES = /* @__PURE__ */ new Set(["single", "multi"]);
var VALID_LAYOUTS = /* @__PURE__ */ new Set([
  "single-page",
  "progressive-reveal",
  "redirect-to-new-page"
]);
var VALID_OTP_MODES = /* @__PURE__ */ new Set(["single-input", "segmented"]);
var VALID_OTP_SOURCES = /* @__PURE__ */ new Set([
  "env",
  "api-intercept",
  "api-request"
]);
var VALID_TOKEN_TYPES = /* @__PURE__ */ new Set([
  "bearer",
  "cookie",
  "custom-header"
]);
var VALID_OAUTH = /* @__PURE__ */ new Set([
  "google",
  "github",
  "microsoft",
  "facebook"
]);
var VALID_OIDC = /* @__PURE__ */ new Set([
  "okta",
  "auth0",
  "azure-ad",
  "keycloak",
  "cognito",
  "ping"
]);
var VALID_SAML = /* @__PURE__ */ new Set([
  "okta",
  "azure",
  "onelogin",
  "ping",
  "adfs"
]);
var VALID_TOKEN_STORAGE_TYPES = /* @__PURE__ */ new Set(["localStorage", "sessionStorage"]);
var BROWSER_ONLY_AUTH_TYPES = /* @__PURE__ */ new Set(["oauth", "oidc", "saml"]);
var OTP_AUTH_TYPES = /* @__PURE__ */ new Set(["email-otp", "email-password-otp"]);
var PASSWORD_AUTH_TYPES = /* @__PURE__ */ new Set([
  "email-password",
  "email-password-otp"
]);
function createCollector() {
  const issues = [];
  function add(level, code, field, message, hint, user) {
    issues.push({ level, code, field, message, hint, user });
  }
  return {
    error: (code, field, message, hint, _, user) => add("error", code, field, message, hint, user),
    warn: (code, field, message, hint, _, user) => add("warning", code, field, message, hint, user),
    issues: () => issues
  };
}
function isValidUrl(raw) {
  try {
    new URL(raw);
    return true;
  } catch {
    return false;
  }
}
function checkUrl(c, field, value, user) {
  if (!value?.trim()) return false;
  if (!isValidUrl(value)) {
    c.error(
      "INVALID_URL",
      field,
      `"${value}" is not a valid URL. Must start with http:// or https://.`,
      `Use a fully-qualified URL, e.g. "http://localhost:3000".`,
      void 0,
      user
    );
    return false;
  }
  return true;
}
function validateGlobalStructure(c, config2) {
  if (!config2.mode) {
    c.error(
      "MODE_MISSING",
      "mode",
      `"mode" is required. Must be "single" or "multi".`
    );
  } else if (!VALID_AUTH_MODES.has(config2.mode)) {
    c.error(
      "INVALID_MODE",
      "mode",
      `"mode" value "${config2.mode}" is not valid.`,
      `Use "single" (shared cached context) or "multi" (fresh context per test).`
    );
  }
  if (VALID_AUTH_MODES.has(config2.mode)) {
  }
  if (!config2.authType) {
    c.error("AUTH_TYPE_MISSING", "authType", `"authType" is required.`);
  } else if (!VALID_AUTH_TYPES.has(config2.authType)) {
    c.error(
      "INVALID_AUTH_TYPE",
      "authType",
      `"authType" value "${config2.authType}" is not recognised.`,
      `Valid values: ${[...VALID_AUTH_TYPES].join(", ")}.`
    );
  }
  if (!config2.storageStatePath?.trim()) {
    c.error(
      "STORAGE_PATH_MISSING",
      "storageStatePath",
      `"storageStatePath" is required. This is the directory where session files are saved.`,
      `Set storageStatePath: ".auth" (or any relative/absolute directory path).`
    );
  }
  if (!config2.BASE_SERVER_URL?.trim()) {
    c.error(
      "BASE_SERVER_URL_MISSING",
      "BASE_SERVER_URL",
      `"BASE_SERVER_URL" is required.`,
      `Set it to the base URL of your application, e.g. "http://localhost:3000".`
    );
  } else {
    checkUrl(c, "BASE_SERVER_URL", config2.BASE_SERVER_URL);
  }
  if (!config2.actionUrl?.trim()) {
    c.error(
      "ACTION_URL_MISSING",
      "actionUrl",
      `"actionUrl" is required. This is the login page URL (or API endpoint when isApi is true).`,
      `Set actionUrl to your login page URL, e.g. "http://localhost:3000/login".`
    );
  } else {
    checkUrl(c, "actionUrl", config2.actionUrl);
  }
  if (config2.authPageLayout && !VALID_LAYOUTS.has(config2.authPageLayout)) {
    c.error(
      "INVALID_AUTH_PAGE_LAYOUT",
      "authPageLayout",
      `"authPageLayout" value "${config2.authPageLayout}" is not valid.`,
      `Valid values: ${[...VALID_LAYOUTS].join(", ")}.`
    );
  }
  if (!Array.isArray(config2.users) || config2.users.length === 0) {
    c.error(
      "USERS_EMPTY",
      "users",
      `"users" is empty. At least one user must be configured.`,
      `Add users to your users.json file and ensure the file path resolves correctly.`
    );
  }
}
function validateBaseAuthType(c, config2) {
  const { authType, isApi } = config2;
  if (OTP_AUTH_TYPES.has(authType)) {
    if (!config2.otpConfig) {
      c.error(
        "OTP_CONFIG_MISSING",
        "otpConfig",
        `authType "${authType}" requires an "otpConfig" block in BASE_CONFIG.`,
        `Add otpConfig: { mode: "single-input", source: "api-request", autoSubmit: false, ... }.`
      );
    } else {
      validateOtpConfig(c, config2.otpConfig, "otpConfig");
    }
  }
  if (authType === "oauth") {
    if (isApi) {
      c.error(
        "OAUTH_API_INCOMPATIBLE",
        "authType + isApi",
        `authType "oauth" is incompatible with isApi: true. OAuth requires a browser flow.`,
        `Remove isApi: true, or switch authType to "email-password" for pure API auth.`
      );
    }
    if (config2.oauthProvider && !VALID_OAUTH.has(config2.oauthProvider)) {
      c.error(
        "INVALID_OAUTH_PROVIDER",
        "oauthProvider",
        `"oauthProvider" value "${config2.oauthProvider}" is not recognised.`,
        `Valid values: ${[...VALID_OAUTH].join(", ")}.`
      );
    }
    if (!config2.oauthProvider) {
      c.warn(
        "OAUTH_PROVIDER_MISSING",
        "oauthProvider",
        `authType "oauth" has no "oauthProvider" set in BASE_CONFIG.`,
        `Set oauthProvider (e.g. "google") or add oauthProvider on each user individually.`
      );
    }
  }
  if (authType === "oidc") {
    if (isApi) {
      c.error(
        "OIDC_API_INCOMPATIBLE",
        "authType + isApi",
        `authType "oidc" is incompatible with isApi: true. OIDC requires a browser flow.`,
        `Remove isApi: true from BASE_CONFIG and from any oidc users.`
      );
    }
    if (config2.oidcProvider && !VALID_OIDC.has(config2.oidcProvider)) {
      c.error(
        "INVALID_OIDC_PROVIDER",
        "oidcProvider",
        `"oidcProvider" value "${config2.oidcProvider}" is not recognised.`,
        `Valid values: ${[...VALID_OIDC].join(", ")}.`
      );
    }
    if (!config2.oidcProvider) {
      c.warn(
        "OIDC_PROVIDER_MISSING",
        "oidcProvider",
        `authType "oidc" has no "oidcProvider" set in BASE_CONFIG. Defaulting to "okta".`,
        `Set oidcProvider in BASE_CONFIG or on each oidc user individually.`
      );
    }
  }
  if (authType === "saml") {
    if (config2.samlProvider && !VALID_SAML.has(config2.samlProvider)) {
      c.error(
        "INVALID_SAML_PROVIDER",
        "samlProvider",
        `"samlProvider" value "${config2.samlProvider}" is not recognised.`,
        `Valid values: ${[...VALID_SAML].join(", ")}.`
      );
    }
    if (!config2.samlProvider) {
      c.warn(
        "SAML_PROVIDER_MISSING",
        "samlProvider",
        `authType "saml" has no "samlProvider" set in BASE_CONFIG. Defaulting to "okta".`,
        `Set samlProvider in BASE_CONFIG or on each saml user individually.`
      );
    }
  }
  if (authType === "custom" && !config2.customStrategy) {
    c.error(
      "CUSTOM_STRATEGY_MISSING",
      "customStrategy",
      `authType "custom" requires a "customStrategy" implementation to be provided.`,
      `Set customStrategy: new YourAuthStrategy() in BASE_CONFIG.`
    );
  }
}
function validateApiConfig(c, apiConfig, isApi, prefix, user) {
  if (!isApi) return;
  if (!apiConfig) {
    c.error(
      "API_CONFIG_MISSING",
      prefix,
      `isApi: true requires an "apiConfig" block with at minimum a "path" field.`,
      `Add apiConfig: { path: "/auth/login" } ${user ? `to user "${user}"` : "to BASE_CONFIG"}.`,
      void 0,
      user
    );
    return;
  }
  if (!apiConfig.path?.trim()) {
    c.error(
      "API_CONFIG_PATH_MISSING",
      `${prefix}.path`,
      `apiConfig.path is required when isApi: true.`,
      `Set it to your login endpoint, e.g. "/auth/login".`,
      void 0,
      user
    );
  } else if (apiConfig.path.startsWith("http")) {
    c.warn(
      "API_PATH_LOOKS_LIKE_FULL_URL",
      `${prefix}.path`,
      `apiConfig.path "${apiConfig.path}" looks like a full URL. It should be a path only (e.g. "/auth/login").`,
      `Move the base URL to actionUrl and keep only the path segment here.`,
      void 0,
      user
    );
  }
  if (apiConfig.tokenType && !VALID_TOKEN_TYPES.has(apiConfig.tokenType)) {
    c.error(
      "INVALID_TOKEN_TYPE",
      `${prefix}.tokenType`,
      `apiConfig.tokenType "${apiConfig.tokenType}" is not valid.`,
      `Valid values: ${[...VALID_TOKEN_TYPES].join(", ")}.`,
      void 0,
      user
    );
  }
  if ((apiConfig.tokenType === "bearer" || apiConfig.tokenType === "custom-header") && !apiConfig.tokenPath?.trim()) {
    c.warn(
      "TOKEN_PATH_MISSING",
      `${prefix}.tokenPath`,
      `apiConfig.tokenType "${apiConfig.tokenType}" should have "tokenPath" set to locate the token in the response body.`,
      `Set tokenPath using dot notation, e.g. "data.accessToken". Defaults to "token".`,
      void 0,
      user
    );
  }
  if (apiConfig.tokenType === "custom-header" && !apiConfig.tokenHeaderName?.trim()) {
    c.error(
      "TOKEN_HEADER_NAME_MISSING",
      `${prefix}.tokenHeaderName`,
      `apiConfig.tokenType "custom-header" requires "tokenHeaderName" to be set.`,
      `Set tokenHeaderName to the exact header name, e.g. "X-Auth-Token".`,
      void 0,
      user
    );
  }
}
function validateTokenStorageConfig(c, tokenConfig, prefix, user) {
  if (!tokenConfig) return;
  if (!tokenConfig.storageType) {
    c.error(
      "TOKEN_STORAGE_TYPE_MISSING",
      `${prefix}.storageType`,
      `tokenStorageConfig.storageType is required.`,
      `Use "localStorage" or "sessionStorage".`,
      void 0,
      user
    );
  } else if (!VALID_TOKEN_STORAGE_TYPES.has(tokenConfig.storageType)) {
    c.error(
      "INVALID_TOKEN_STORAGE_TYPE",
      `${prefix}.storageType`,
      `tokenStorageConfig.storageType "${tokenConfig.storageType}" is invalid.`,
      `Valid values: localStorage, sessionStorage.`,
      void 0,
      user
    );
  }
  if (!tokenConfig.storageKey?.trim()) {
    c.error(
      "TOKEN_STORAGE_KEY_MISSING",
      `${prefix}.storageKey`,
      `tokenStorageConfig.storageKey is required.`,
      `Set the browser storage key e.g. "auth", "user", "session".`,
      void 0,
      user
    );
  }
  if (tokenConfig.origin && !isValidUrl(tokenConfig.origin)) {
    c.error(
      "INVALID_TOKEN_STORAGE_ORIGIN",
      `${prefix}.origin`,
      `"${tokenConfig.origin}" is not a valid URL.`,
      `Use full origin e.g. "https://app.example.com".`,
      void 0,
      user
    );
  }
  if (tokenConfig.tokenPath !== void 0 && !tokenConfig.tokenPath.trim()) {
    c.warn(
      "EMPTY_TOKEN_PATH",
      `${prefix}.tokenPath`,
      `tokenPath was provided but is empty.`,
      `Remove it or provide a dot path like "data.token".`,
      void 0,
      user
    );
  }
  if (tokenConfig.attachBearer !== void 0 && typeof tokenConfig.attachBearer !== "boolean") {
    c.error(
      "INVALID_ATTACH_BEARER",
      `${prefix}.attachBearer`,
      `attachBearer must be boolean.`,
      void 0,
      void 0,
      user
    );
  }
}
function validateOtpConfig(c, otp, prefix, user) {
  if (!otp.mode) {
    c.error(
      "OTP_MODE_MISSING",
      `${prefix}.mode`,
      `otpConfig.mode is required.`,
      `Set to "single-input" (one field for the full code) or "segmented" (one input per digit).`,
      void 0,
      user
    );
  } else if (!VALID_OTP_MODES.has(otp.mode)) {
    c.error(
      "INVALID_OTP_MODE",
      `${prefix}.mode`,
      `otpConfig.mode "${otp.mode}" is not valid.`,
      `Valid values: "single-input" | "segmented".`,
      void 0,
      user
    );
  }
  if (otp.mode === "segmented") {
    if (otp.fieldCount === void 0) {
      c.warn(
        "SEGMENTED_FIELD_COUNT_MISSING",
        `${prefix}.fieldCount`,
        `otpConfig.mode "segmented" has no fieldCount. Defaulting to 6.`,
        `Set fieldCount to the number of digit inputs on your OTP form.`,
        void 0,
        user
      );
    } else if (!Number.isInteger(otp.fieldCount) || otp.fieldCount < 1) {
      c.error(
        "INVALID_SEGMENTED_FIELD_COUNT",
        `${prefix}.fieldCount`,
        `otpConfig.fieldCount must be a positive integer, got "${otp.fieldCount}".`,
        void 0,
        void 0,
        user
      );
    }
  }
  if (!otp.source) {
    c.error(
      "OTP_SOURCE_MISSING",
      `${prefix}.source`,
      `otpConfig.source is required.`,
      `Valid values: "env" | "api-intercept" | "api-request".`,
      void 0,
      user
    );
    return;
  } else if (!VALID_OTP_SOURCES.has(otp.source)) {
    c.error(
      "INVALID_OTP_SOURCE",
      `${prefix}.source`,
      `otpConfig.source "${otp.source}" is not valid.`,
      `Valid values: "env" | "api-intercept" | "api-request".`,
      void 0,
      user
    );
    return;
  }
  if (otp.source === "env") {
    const key = otp.envKey ?? "TEST_OTP";
    if (!otp.envKey) {
      c.warn(
        "OTP_ENV_KEY_MISSING",
        `${prefix}.envKey`,
        `otpConfig.source "env" has no "envKey". Defaulting to "TEST_OTP".`,
        `Set envKey to the name of the environment variable that holds the OTP.`,
        void 0,
        user
      );
    }
    if (!process.env[key]) {
      c.warn(
        "OTP_ENV_VAR_NOT_SET",
        `${prefix}.envKey`,
        `otpConfig.envKey resolves to "$${key}" but that environment variable is not currently set.`,
        `Export ${key}=<your-test-otp> in your shell or .env file before running tests.`,
        void 0,
        user
      );
    }
  }
  if (otp.source === "api-intercept") {
    if (!otp.interceptPattern?.trim()) {
      c.warn(
        "OTP_INTERCEPT_PATTERN_MISSING",
        `${prefix}.interceptPattern`,
        `otpConfig.source "api-intercept" has no "interceptPattern". Defaulting to "**/api/send-otp**".`,
        `Set interceptPattern to a Playwright route glob that matches your OTP delivery endpoint.`,
        void 0,
        user
      );
    }
  }
  if (otp.source === "api-request") {
    validateOtpRequestConfig(c, otp, prefix, user);
  }
}
function validateOtpRequestConfig(c, otp, prefix, user) {
  if (!otp.requestConfig) {
    c.error(
      "OTP_REQUEST_CONFIG_MISSING",
      `${prefix}.requestConfig`,
      `otpConfig.source "api-request" requires a "requestConfig" block.`,
      `Add requestConfig: { baseUrl: "...", path: "/auth/get-otp/{username}" }.`,
      void 0,
      user
    );
  } else {
    if (!otp.requestConfig.baseUrl?.trim()) {
      c.error(
        "OTP_REQUEST_BASE_URL_MISSING",
        `${prefix}.requestConfig.baseUrl`,
        `otpConfig.requestConfig.baseUrl is required.`,
        void 0,
        void 0,
        user
      );
    } else {
      checkUrl(
        c,
        `${prefix}.requestConfig.baseUrl`,
        otp.requestConfig.baseUrl,
        user
      );
    }
    if (!otp.requestConfig.path?.trim()) {
      c.error(
        "OTP_REQUEST_PATH_MISSING",
        `${prefix}.requestConfig.path`,
        `otpConfig.requestConfig.path is required.`,
        `Set it to your OTP fetch endpoint path. Supports {username} and {userId} placeholders.`,
        void 0,
        user
      );
    }
    if (otp.requestConfig.method && !["GET", "POST"].includes(otp.requestConfig.method)) {
      c.error(
        "INVALID_OTP_REQUEST_METHOD",
        `${prefix}.requestConfig.method`,
        `otpConfig.requestConfig.method "${otp.requestConfig.method}" is not valid.`,
        `Valid values: "GET" | "POST".`,
        void 0,
        user
      );
    }
  }
  if (!otp.verifyConfig) {
    c.warn(
      "OTP_VERIFY_CONFIG_MISSING",
      `${prefix}.verifyConfig`,
      `otpConfig.source "api-request" has no "verifyConfig". The framework will rely on browser form submission to verify the OTP.`,
      `Add verifyConfig if your app has a dedicated OTP verification endpoint that returns a token.`,
      void 0,
      user
    );
  } else {
    if (!otp.verifyConfig.baseUrl?.trim()) {
      c.error(
        "OTP_VERIFY_BASE_URL_MISSING",
        `${prefix}.verifyConfig.baseUrl`,
        `otpConfig.verifyConfig.baseUrl is required when verifyConfig is present.`,
        void 0,
        void 0,
        user
      );
    } else {
      checkUrl(
        c,
        `${prefix}.verifyConfig.baseUrl`,
        otp.verifyConfig.baseUrl,
        user
      );
    }
    if (!otp.verifyConfig.path?.trim()) {
      c.error(
        "OTP_VERIFY_PATH_MISSING",
        `${prefix}.verifyConfig.path`,
        `otpConfig.verifyConfig.path is required when verifyConfig is present.`,
        void 0,
        void 0,
        user
      );
    }
    if (otp.verifyConfig.method && !["GET", "POST"].includes(otp.verifyConfig.method)) {
      c.error(
        "INVALID_OTP_VERIFY_METHOD",
        `${prefix}.verifyConfig.method`,
        `otpConfig.verifyConfig.method "${otp.verifyConfig.method}" is not valid.`,
        `Valid values: "GET" | "POST".`,
        void 0,
        user
      );
    }
  }
}
function validateUsers(c, config2) {
  if (!Array.isArray(config2.users) || config2.users.length === 0) return;
  const seen = /* @__PURE__ */ new Map();
  for (const [idx, user] of config2.users.entries()) {
    if (!user.username?.trim()) continue;
    const key = user.username.toLowerCase();
    if (seen.has(key)) {
      c.error(
        "DUPLICATE_USERNAME",
        `users[${idx}].username`,
        `Duplicate username "${user.username}" at index ${idx} (first seen at index ${seen.get(key)}).`,
        `Each user must have a unique username. Remove or rename the duplicate.`
      );
    } else {
      seen.set(key, idx);
    }
  }
  for (const [idx, user] of config2.users.entries()) {
    validateSingleUser(c, config2, user, idx);
  }
}
function validateSingleUser(c, config2, user, idx) {
  if (!user.username?.trim()) {
    c.error(
      "USER_USERNAME_MISSING",
      `users[${idx}].username`,
      `User at index ${idx} has no "username". Every user entry requires a non-empty username.`
    );
    return;
  }
  const label = `users["${user.username}"]`;
  const u = user.username;
  const effectiveAuthType = user.authType ?? config2.authType;
  const effectiveIsApi = user.isApi ?? config2.isApi ?? false;
  const effectiveApiConfig = user.apiConfig || (effectiveIsApi ? config2.apiConfig : void 0);
  const effectiveOtpConfig = user.otpConfig ?? config2.otpConfig;
  const effectiveOAuthProv = user.oauthProvider ?? config2.oauthProvider;
  const effectiveOIDCProv = user.oidcProvider ?? config2.oidcProvider;
  const effectiveSAMLProv = user.samlProvider ?? config2.samlProvider;
  const effectiveTokenStorage = user.tokenStorageConfig ?? config2.tokenStorageConfig;
  if (user.authType && !VALID_AUTH_TYPES.has(user.authType)) {
    c.error(
      "USER_INVALID_AUTH_TYPE",
      `${label}.authType`,
      `User "${u}" has an unrecognised authType "${user.authType}".`,
      `Valid values: ${[...VALID_AUTH_TYPES].join(", ")}.`,
      void 0,
      u
    );
    return;
  }
  if (user.authPageLayout && !VALID_LAYOUTS.has(user.authPageLayout)) {
    c.error(
      "USER_INVALID_LAYOUT",
      `${label}.authPageLayout`,
      `User "${u}" has an unrecognised authPageLayout "${user.authPageLayout}".`,
      `Valid values: ${[...VALID_LAYOUTS].join(", ")}.`,
      void 0,
      u
    );
  }
  if (BROWSER_ONLY_AUTH_TYPES.has(effectiveAuthType) && effectiveIsApi) {
    c.error(
      "USER_BROWSER_ONLY_AUTH_WITH_API",
      `${label}.authType + isApi`,
      `User "${u}" has authType "${effectiveAuthType}" with isApi: true. This combination is not supported \u2014 ${effectiveAuthType} requires a browser flow.`,
      `Remove isApi: true from this user (or from BASE_CONFIG if it is inherited).`,
      void 0,
      u
    );
  }
  if (PASSWORD_AUTH_TYPES.has(effectiveAuthType) && !effectiveIsApi && !user.password) {
    c.error(
      "USER_PASSWORD_MISSING",
      `${label}.password`,
      `User "${u}" uses authType "${effectiveAuthType}" but has no "password" set.`,
      `Add "password": "yourPassword" to this user in users.json.`,
      void 0,
      u
    );
  }
  if (OTP_AUTH_TYPES.has(effectiveAuthType) && !effectiveIsApi) {
    if (!effectiveOtpConfig) {
      c.error(
        "USER_OTP_CONFIG_MISSING",
        `${label}.otpConfig`,
        `User "${u}" uses authType "${effectiveAuthType}" but has no otpConfig \u2014 neither on the user nor in BASE_CONFIG.`,
        `Add an otpConfig block directly on this user in users.json, or add a default to BASE_CONFIG.`,
        void 0,
        u
      );
    } else if (user.otpConfig) {
      validateOtpConfig(c, user.otpConfig, `${label}.otpConfig`, u);
    }
  }
  validateApiConfig(
    c,
    effectiveApiConfig,
    effectiveIsApi,
    `${label}.apiConfig`,
    u
  );
  validateTokenStorageConfig(
    c,
    effectiveTokenStorage,
    `${label}.tokenStorageConfig`,
    u
  );
  if (user.oauthProvider && !VALID_OAUTH.has(user.oauthProvider)) {
    c.error(
      "USER_INVALID_OAUTH_PROVIDER",
      `${label}.oauthProvider`,
      `User "${u}" has an unrecognised oauthProvider "${user.oauthProvider}".`,
      `Valid values: ${[...VALID_OAUTH].join(", ")}.`,
      void 0,
      u
    );
  }
  if (user.oidcProvider && !VALID_OIDC.has(user.oidcProvider)) {
    c.error(
      "USER_INVALID_OIDC_PROVIDER",
      `${label}.oidcProvider`,
      `User "${u}" has an unrecognised oidcProvider "${user.oidcProvider}".`,
      `Valid values: ${[...VALID_OIDC].join(", ")}.`,
      void 0,
      u
    );
  }
  if (user.samlProvider && !VALID_SAML.has(user.samlProvider)) {
    c.error(
      "USER_INVALID_SAML_PROVIDER",
      `${label}.samlProvider`,
      `User "${u}" has an unrecognised samlProvider "${user.samlProvider}".`,
      `Valid values: ${[...VALID_SAML].join(", ")}.`,
      void 0,
      u
    );
  }
  if (effectiveAuthType !== "oauth" && user.oauthProvider) {
    c.warn(
      "USER_OAUTH_PROVIDER_UNUSED",
      `${label}.oauthProvider`,
      `User "${u}" has oauthProvider set but authType is "${effectiveAuthType}". The oauthProvider will be ignored.`,
      void 0,
      void 0,
      u
    );
  }
  if (effectiveAuthType !== "oidc" && user.oidcProvider) {
    c.warn(
      "USER_OIDC_PROVIDER_UNUSED",
      `${label}.oidcProvider`,
      `User "${u}" has oidcProvider set but authType is "${effectiveAuthType}". The oidcProvider will be ignored.`,
      void 0,
      void 0,
      u
    );
  }
  if (effectiveAuthType !== "saml" && user.samlProvider) {
    c.warn(
      "USER_SAML_PROVIDER_UNUSED",
      `${label}.samlProvider`,
      `User "${u}" has samlProvider set but authType is "${effectiveAuthType}". The samlProvider will be ignored.`,
      void 0,
      void 0,
      u
    );
  }
  if (effectiveAuthType === "oauth" && !effectiveOAuthProv) {
    c.warn(
      "USER_OAUTH_PROVIDER_MISSING",
      `${label}.oauthProvider`,
      `User "${u}" uses authType "oauth" but has no oauthProvider (user-level or BASE_CONFIG). Defaulting to "google".`,
      void 0,
      void 0,
      u
    );
  }
  if (effectiveAuthType === "oidc" && !effectiveOIDCProv) {
    c.warn(
      "USER_OIDC_PROVIDER_MISSING",
      `${label}.oidcProvider`,
      `User "${u}" uses authType "oidc" but has no oidcProvider (user-level or BASE_CONFIG). Defaulting to "okta".`,
      void 0,
      void 0,
      u
    );
  }
  if (effectiveAuthType === "saml" && !effectiveSAMLProv) {
    c.warn(
      "USER_SAML_PROVIDER_MISSING",
      `${label}.samlProvider`,
      `User "${u}" uses authType "saml" but has no samlProvider (user-level or BASE_CONFIG). Defaulting to "okta".`,
      void 0,
      void 0,
      u
    );
  }
  if (!user.actionUrl && !config2.actionUrl) {
    c.error(
      "USER_ACTION_URL_MISSING",
      `${label}.actionUrl`,
      `User "${u}" has no "actionUrl" and BASE_CONFIG has no fallback "actionUrl" either.`,
      `Add "actionUrl": "http://..." to this user in users.json, or set a default in BASE_CONFIG.`,
      void 0,
      u
    );
  } else if (user.actionUrl) {
    checkUrl(c, `${label}.actionUrl`, user.actionUrl, u);
  }
}
function validateCrossFieldRules(c, config2) {
  if (config2.BASE_SERVER_URL && config2.actionUrl && config2.isApi && config2.apiConfig?.path) {
    try {
      const base2 = new URL(config2.BASE_SERVER_URL);
      const action = new URL(config2.actionUrl);
      const apiPath = config2.apiConfig.path;
      if (action.pathname !== "/" && action.pathname === apiPath) {
        c.warn(
          "ACTION_URL_PATH_MATCHES_API_PATH",
          "actionUrl + apiConfig.path",
          `actionUrl path ("${action.pathname}") is identical to apiConfig.path ("${apiPath}"). The login URL will be constructed as "${config2.actionUrl}${apiPath}" which duplicates the segment.`,
          `Set actionUrl to the base origin only (e.g. "${base2.origin}") and put the login path in apiConfig.path.`
        );
      }
    } catch {
    }
  }
  if (config2.storageStatePath?.includes("..")) {
    c.warn(
      "STORAGE_PATH_TRAVERSAL",
      "storageStatePath",
      `storageStatePath "${config2.storageStatePath}" contains ".." which may resolve outside the project root.`,
      `Use a path relative to the project root without ".." traversal, e.g. ".auth" or "tmp/sessions".`
    );
  }
  if (config2.rateLimited && Array.isArray(config2.users) && config2.users.length === 1) {
    c.warn(
      "RATE_LIMITED_SINGLE_USER",
      "rateLimited",
      `rateLimited: true has no effect when there is only one user \u2014 there is nothing to throttle.`,
      `Remove rateLimited: true to avoid a misleading 500ms delay during setup.`
    );
  }
  if (OTP_AUTH_TYPES.has(config2.authType) && !config2.otpConfig) {
    const missing = (config2.users ?? []).filter(
      (u) => !u.otpConfig && !(u.authType && !OTP_AUTH_TYPES.has(u.authType))
    );
    if (missing.length >= 3) {
      c.warn(
        "BULK_OTP_CONFIG_MISSING",
        "otpConfig",
        `${missing.length} users inherit authType "${config2.authType}" but BASE_CONFIG has no otpConfig. Each of these users will need their own otpConfig block.`,
        `Consider adding a default otpConfig to BASE_CONFIG so users inherit it automatically.`
      );
    }
  }
}
function validateConfig(config2) {
  const c = createCollector();
  validateGlobalStructure(c, config2);
  validateBaseAuthType(c, config2);
  validateTokenStorageConfig(
    c,
    config2.tokenStorageConfig,
    "tokenStorageConfig"
  );
  validateApiConfig(c, config2.apiConfig, config2.isApi, "apiConfig");
  validateUsers(c, config2);
  validateCrossFieldRules(c, config2);
  const issues = c.issues();
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  if (warnings.length > 0) {
    const warningLines = [
      `
\x1B[33m\x1B[1m[PWMAF] Config validation: ${warnings.length} warning(s)\x1B[0m`,
      ...warnings.map(
        (w, i) => `  \x1B[33m[${i + 1}] ${w.code}\x1B[0m  ${w.field}
      ${w.message}` + (w.hint ? `
      \x1B[2mFix: ${w.hint}\x1B[0m` : "")
      ),
      ""
    ];
    process.stderr.write(warningLines.join("\n") + "\n");
  }
  if (errors.length > 0) {
    throw new ConfigValidationError([...issues]);
  }
}

// src/core/AuthManagerInstance.ts
var authManagerInstance = null;
var authConfig;
async function deleteAuthStore(folderPath) {
  const absolutePath = import_path4.default.resolve(process.cwd(), folderPath);
  try {
    await import_promises.default.rm(absolutePath, {
      recursive: true,
      force: true
    });
  } catch (error) {
    console.info(`Failed to delete auth store: ${absolutePath}`, error);
  }
}
async function getOrCreateAuthManager() {
  if (!authManagerInstance) {
    const _path = process.env.AUTH_USERS_FILE || import_path4.default.resolve(process.cwd(), "src/data/users.json");
    authConfig = await createAuthConfig(_path);
    validateConfig(authConfig);
    if (authConfig.deleteAuthStorageOnTestRun) {
      await deleteAuthStore(authConfig.storageStatePath);
    }
    if (!authConfig.users?.length) {
      throw new Error("No users found in users.json");
    }
    authManagerInstance = new AuthManager(authConfig);
  }
  return authManagerInstance;
}

// src/utils/helpers.ts
function isTokenExpired(storage, opts = {}) {
  const cookieName = opts.cookieName ?? "auth_token";
  const authCookie = storage.cookies?.find((c) => c.name === cookieName);
  if (authCookie?.value) {
    try {
      const payload = JSON.parse(
        Buffer.from(authCookie.value.split(".")[1], "base64url").toString()
      );
      return payload.exp ? Date.now() >= payload.exp * 1e3 : true;
    } catch {
      return true;
    }
  }
  const savedAt = storage.metadata?.savedAt;
  const expiresAt = storage.metadata?.expiresAt;
  if (expiresAt) return Date.now() >= new Date(expiresAt).getTime();
  if (savedAt) {
    return Date.now() - new Date(savedAt).getTime() > 60 * 60 * 1e3;
  }
  return false;
}
async function ensureValidSession(username, browser) {
  const file = `.auth/${username}.json`;
  const state = await import_promises2.default.readFile(file, "utf-8").catch(() => null);
  if (!state) {
    const authManager = await getOrCreateAuthManager();
    await authManager.reauthenticateUser(username, browser);
    return;
  }
  const parsed = JSON.parse(state);
  if (isTokenExpired(parsed)) {
    await import_promises2.default.rm(file, { force: true });
    const authManager = await getOrCreateAuthManager();
    await authManager.reauthenticateUser(username, browser);
  }
}
function buildApiUrl(baseUrl, path5) {
  if (!baseUrl) {
    throw new Error("actionUrl is required when using API authentication");
  }
  try {
    const url = new URL(baseUrl);
    if (path5 && url.pathname !== "/") {
      throw new Error(
        [
          `Invalid API auth configuration.`,
          `actionUrl should contain only origin.`,
          `Received: "${baseUrl}"`,
          `Move endpoint into apiConfig.path.`
        ].join(" ")
      );
    }
    if (path5) {
      url.pathname = path5.startsWith("/") ? path5 : `/${path5}`;
    }
    return url.toString();
  } catch (err) {
    throw new Error(
      `Invalid API authentication URL configuration: ${err.message}`
    );
  }
}
function authFile(username) {
  return `.auth/${username}.json`;
}
async function validateUserEndpoints(users) {
  for (const user of users) {
    if (!user.actionUrl) {
      throw new Error(`Missing actionUrl for user ${user.username}`);
    }
    try {
      const response = await fetch(user.actionUrl);
      if (!response.ok) {
        throw new Error(`Received ${response.status} from ${user.actionUrl}`);
      }
      console.log(`[globalSetup] ${user.username} -> ${user.actionUrl} [OK]`);
    } catch (error) {
      throw new Error(
        `Failed to reach ${user.actionUrl} for user ${user.username}: ${error}`
      );
    }
  }
}

// src/strategeies/EmailPasswordStrategy.ts
var EmailPasswordStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[EmailPassword][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START authenticate");
      const authUrl = user?.actionUrl?.trim() ?? config2.actionUrl ?? "";
      const successUrl = config2.successUrl ?? "**/dashboard**";
      const authPageLayout = (user.authPageLayout || config2.authPageLayout) ?? "single-page";
      log(`authUrl: ${authUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`layout: ${authPageLayout}`);
      if (user.isApi || config2.isApi) {
        log("ENTER API AUTH PATH");
        const context2 = await this.authenticateViaAPI(
          browser,
          user,
          authUrl,
          config2
        );
        log("API request completed");
        return {
          context: context2,
          metadata: {
            authType: "email-password",
            authPath: "api",
            username: user.username,
            tokenType: (user.apiConfig ?? config2.apiConfig)?.tokenType ?? "cookie"
          }
        };
      }
      if (!user?.password) {
        throw new Error("Password is required for EmailPassword Strategy");
      }
      log("Password validated");
      const context = await browser.newContext();
      log("Browser context created");
      const page = await context.newPage();
      log("Page created");
      const authPage = new AuthPage(page, config2.selectors);
      log(`Navigating \u2192 ${authUrl}`);
      await page.goto(authUrl);
      log("Navigation complete");
      if (authPageLayout === "single-page") {
        log("Single-page login flow");
        await authPage.fillEmail(user.username);
        log("Email filled");
        await authPage.fillPassword(user.password);
        log("Password filled");
        await authPage.submitPassword();
        log("Password submitted");
      } else if (authPageLayout === "progressive-reveal") {
        log("Progressive reveal login flow");
        await authPage.fillEmail(user.username);
        log("Email filled");
        await authPage.submitEmail();
        log("Email submitted");
        log("Waiting for password field");
        await authPage.passwordField().waitFor({
          state: "visible"
        });
        log("Password field visible");
        await authPage.fillPassword(user.password);
        log("Password filled");
        await authPage.submitPassword();
        log("Password submitted");
      }
      if (authPageLayout === "redirect-to-new-page") {
        throw new Error(
          "redirect-to-new-page is Unsupported for email password"
        );
      }
      log(`Waiting for URL: ${successUrl}`);
      await page.waitForURL(successUrl);
      log("SUCCESS URL reached");
      log("AUTH SUCCESS (BROWSER)");
      return {
        context,
        metadata: {
          authType: "email-password",
          authPath: "browser",
          username: user.username,
          tokenType: config2.apiConfig?.tokenType ?? "cookie"
        }
      };
    } catch (error) {
      console.error(
        `[EmailPassword][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error
      );
      throw error;
    }
  }
  async authenticateViaAPI(browser, user, baseUrl, config2) {
    const started = Date.now();
    const log = (step) => {
      console.log(
        `[EmailPassword-API][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    log("START API auth");
    const apiConfig = user.apiConfig ?? config2.apiConfig ?? { path: "" };
    const fieldMap = apiConfig.fieldMap ?? {};
    const url = buildApiUrl(baseUrl, apiConfig.path);
    log(`POST ${url}`);
    const body = {
      [fieldMap.username ?? "username"]: user.username,
      [fieldMap.password ?? "password"]: user.password,
      ...apiConfig.additionalFields
    };
    log(`Request body prepared`);
    const context = await browser.newContext();
    const response = await context.request.post(url, {
      data: body,
      headers: apiConfig.headers ?? {}
    });
    log(`Response received (${response.status()})`);
    if (!response.ok()) {
      throw new Error(
        `API auth failed: ${response.status()} ${response.statusText()} : ${url}`
      );
    }
    const tokenType = apiConfig.tokenType ?? "cookie";
    log(`tokenType: ${tokenType}`);
    if (tokenType === "cookie") {
      log("COOKIE MODE - returning context");
      return context;
    }
    const responseBody = await response.json();
    const tokenPath = apiConfig.tokenPath ?? "token";
    const token = this.extractFromPath(responseBody, tokenPath);
    log(`Token extracted: ${token ? "YES" : "NO"}`);
    if (!token) {
      throw new Error(
        `Could not extract token at path "${tokenPath}". Response: ${JSON.stringify(responseBody)}`
      );
    }
    if (tokenType === "bearer") {
      log("Setting Bearer token header");
      await context.setExtraHTTPHeaders({
        Authorization: `Bearer ${String(token)}`
      });
    } else if (tokenType === "custom-header") {
      if (!apiConfig.tokenHeaderName) {
        throw new Error(
          `tokenHeaderName is required when tokenType is "custom-header"`
        );
      }
      log(`Setting custom header: ${apiConfig.tokenHeaderName}`);
      await context.setExtraHTTPHeaders({
        [apiConfig.tokenHeaderName]: String(token)
      });
    }
    log("API AUTH SUCCESS");
    return context;
  }
  extractFromPath(data, dotPath) {
    return dotPath.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object") {
        return acc[key];
      }
      return void 0;
    }, data);
  }
};

// src/core/OtpResolver.ts
var import_axios = __toESM(require("axios"));
var import_tough_cookie = require("tough-cookie");
var OTPResolver = class {
  constructor(config2) {
    this.config = config2;
    this.capturedOTP = null;
    this.jar = new import_tough_cookie.CookieJar();
    this.client = import_axios.default.create({
      withCredentials: true
    });
  }
  async attachCookies(url, headers = {}) {
    const cookieString = await this.jar.getCookieString(url);
    if (cookieString) {
      headers["Cookie"] = cookieString;
    }
    return headers;
  }
  async storeCookies(url, response) {
    const setCookie = response.headers?.["set-cookie"];
    if (!setCookie) return;
    for (const cookie of setCookie) {
      await this.jar.setCookie(cookie, url);
    }
  }
  async interceptOTP(page) {
    const pattern = this.config.interceptPattern ?? "**/api/send-otp**";
    await page.route(pattern, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      this.capturedOTP = body.otp ?? body.code ?? body.token ?? null;
      await route.fulfill({ response });
    });
  }
  async resolve(user) {
    if (this.config.source === "env") {
      const key = this.config.envKey ?? "TEST_OTP";
      const otp = process.env[key];
      if (!otp) {
        throw new Error(`OTP env key "${key}" is not set`);
      }
      return otp;
    }
    if (user?.otpConfig?.source === "api-intercept" || this.config.source === "api-intercept") {
      const deadline = Date.now() + 1e4;
      while (!this.capturedOTP) {
        if (Date.now() > deadline) {
          throw new Error(
            `OTP not captured within 10s. Check interceptPattern in otpConfig.`
          );
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      return this.capturedOTP;
    }
    if (user?.otpConfig?.source === "api-request" || this.config.source === "api-request") {
      return this.resolveViaRequest(user);
    }
    throw new Error(`OTP source "${this.config.source}" is not supported.`);
  }
  async resolveViaRequest(user) {
    const reqConfig = user?.otpConfig?.requestConfig || this.config?.requestConfig;
    if (!reqConfig) {
      throw new Error(
        `otpConfig.requestConfig is required when source is "api-request"`
      );
    }
    const url = this.buildUrl(reqConfig, user);
    const queryParams = this.resolvePlaceholders(
      reqConfig.queryParams ?? {},
      user
    );
    const body = this.resolvePlaceholders(
      reqConfig.body ?? {},
      user
    );
    const headers = await this.attachCookies(url, reqConfig.headers ?? {});
    const response = await this.client({
      method: reqConfig.method ?? "GET",
      url,
      params: Object.keys(queryParams).length ? queryParams : void 0,
      data: reqConfig.method === "POST" ? body : void 0,
      headers
    });
    await this.storeCookies(url, response);
    const otp = this.extractFromPath(
      response.data,
      reqConfig.responsePath ?? "otp"
    );
    if (!otp) {
      throw new Error(
        `Could not extract OTP from response at path "${reqConfig.responsePath ?? "otp"}". Response was: ${JSON.stringify(response.data)}`
      );
    }
    return String(otp);
  }
  async handleOTPVerification(user, otp) {
    const reqConfig = user?.otpConfig?.verifyConfig || this.config.verifyConfig;
    if (!reqConfig) {
      throw new Error(
        `otpConfig.verifyConfig is required when source is "api-request"`
      );
    }
    const url = this.buildUrl(reqConfig, user, otp);
    const queryParams = this.resolvePlaceholders(
      reqConfig.queryParams ?? {},
      user
    );
    const body = this.resolvePlaceholders(
      reqConfig.body ?? {},
      user,
      otp
    );
    const headers = await this.attachCookies(url, reqConfig.headers ?? {});
    const response = await this.client({
      method: reqConfig.method ?? "GET",
      url,
      params: Object.keys(queryParams).length ? queryParams : void 0,
      data: reqConfig.method === "POST" ? body : void 0,
      headers
    });
    await this.storeCookies(url, response);
    if (response.status !== 200) {
      throw new Error(
        `API auth failed: ${response.status} ${response.statusText} : ${url}`
      );
    }
    const accessToken = this.extractFromPath(
      response.data,
      reqConfig.accessTokenPath ?? "accessToken"
    );
    const refreshToken = this.extractFromPath(
      response.data,
      reqConfig.refreshTokenPath ?? "refreshToken"
    );
    const cookies = await this.extractCookies();
    if (!accessToken && !cookies?.length) {
      throw new Error(
        "Could not build a proper AuthSession without 'Access Token' & 'Cookies'"
      );
    }
    return {
      cookies,
      accessToken,
      refreshToken
    };
  }
  buildUrl(reqConfig, user, otp) {
    let resolvedPath = reqConfig.path;
    if (user) {
      resolvedPath = this.replacePlaceholder(
        resolvedPath,
        "username",
        user.username
      );
      resolvedPath = this.replacePlaceholder(
        resolvedPath,
        "userId",
        user.username
      );
    }
    if (otp) {
      resolvedPath = this.replacePlaceholder(resolvedPath, "otp", otp);
    }
    return `${reqConfig.baseUrl}${resolvedPath}`;
  }
  resolvePlaceholders(params, user, otp) {
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      let resolvedValue = value;
      if (user) {
        resolvedValue = this.replacePlaceholder(
          resolvedValue,
          "username",
          user.username
        );
        resolvedValue = this.replacePlaceholder(
          resolvedValue,
          "userId",
          user.username
        );
      }
      if (otp) {
        resolvedValue = this.replacePlaceholder(resolvedValue, "otp", otp);
      }
      resolved[key] = resolvedValue;
    }
    return resolved;
  }
  replacePlaceholder(template, placeholder, value) {
    return template.replace(new RegExp(`{${placeholder}}`, "g"), value ?? "");
  }
  extractFromPath(data, dotPath) {
    return dotPath.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object") {
        return acc[key];
      }
      return void 0;
    }, data);
  }
  async extractCookies() {
    const baseUrl = this.config.verifyConfig?.baseUrl;
    if (!baseUrl) return [];
    return this.jar.getCookies(baseUrl);
  }
};

// src/strategeies/EmailOTPStrategy.ts
var EmailOTPStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[EmailOTPStrategy][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START authenticate");
      const authUrl = user.actionUrl ?? config2.actionUrl ?? "";
      if (!config2.otpConfig) {
        throw new Error(
          `EmailOTPStrategy requires otpConfig to be defined in IAuthConfig`
        );
      }
      log("Loaded config");
      const otpConfig = config2.otpConfig;
      const otpResolver = new OTPResolver(otpConfig);
      if (user.isApi || config2.isApi) {
        log("Entering API auth path");
        const context2 = await browser.newContext();
        log("Created browser context");
        const otp2 = await otpResolver.resolve(user);
        log(`Resolved OTP: ${otp2 ? "SUCCESS" : "EMPTY"}`);
        const session = await otpResolver.handleOTPVerification(user, otp2);
        log("OTP verification completed");
        if (session) {
          await this.applySession(context2, session);
          log("Applied session");
        }
        log("AUTH SUCCESS (API)");
        return {
          context: context2,
          metadata: {
            authType: "email-otp",
            authPath: "api",
            username: user.username,
            otpSource: otpConfig.source
          }
        };
      }
      log("Entering browser auth path");
      const successUrl = config2.successUrl ?? "**/dashboard**";
      const authPageLayout = (user.authPageLayout || config2.authPageLayout) ?? "single-page";
      const context = await browser.newContext();
      log("Created browser context");
      const page = await context.newPage();
      log("Created page");
      const authPage = new AuthPage(page, config2.selectors);
      if (otpConfig.source === "api-intercept") {
        log("Starting OTP interception");
        await otpResolver.interceptOTP(page);
        log("OTP interception ready");
      }
      log(`Navigating => ${authUrl}`);
      await page.goto(authUrl);
      log("Navigation completed");
      await authPage.fillEmail(user.username);
      log("Email filled");
      await authPage.submitEmail();
      log("Email submitted");
      log(`Waiting for OTP screen (${otpConfig.mode})`);
      await this.waitForOTPByMode(
        authPage,
        otpConfig.mode,
        authPageLayout,
        otpConfig.otpPageUrl
      );
      log("OTP screen detected");
      const otp = await otpResolver.resolve(user);
      log(`OTP resolved => ${otp}`);
      if (otpConfig.mode === "segmented") {
        log("Filling segmented OTP");
        await authPage.fillOTP(
          otp,
          otpConfig.strategy,
          otpConfig.fieldCount ?? 6
        );
        log("Segmented OTP filled");
      } else if (otpConfig.mode === "single-input") {
        log("Filling single OTP");
        await authPage.fillOTP(otp);
        log("Single OTP filled");
      }
      if (!otpConfig.autoSubmit) {
        log("Submitting OTP");
        await authPage.submitOTP();
        log("OTP submitted");
      }
      log(`Waiting for success URL => ${successUrl}`);
      await page.waitForURL(successUrl);
      log("Success URL reached");
      log("AUTH SUCCESS (Browser)");
      return {
        context,
        metadata: {
          authType: "email-otp",
          authPath: "browser",
          username: user.username,
          otpSource: otpConfig.source
        }
      };
    } catch (error) {
      console.error(
        `[EmailOTPStrategy][${user.username}] FAILED after ${Date.now() - started}ms`,
        error
      );
      throw error;
    }
  }
  async waitForOTPByMode(authPage, mode, authPageLayout, otpPageUrl) {
    if (authPageLayout === "redirect-to-new-page") {
      await authPage.waitForOTPPage(otpPageUrl ?? "**/otp**");
    }
    if (mode === "segmented") {
      await authPage.waitForOTPMultiField();
    } else {
      await authPage.waitForOTPInline();
    }
  }
  async applySession(context, session) {
    if (session.cookies?.length) {
      await context.addCookies(
        session.cookies.map((cookie) => ({
          name: cookie.key,
          value: cookie.value,
          domain: cookie.domain ?? "",
          path: cookie.path ?? "/",
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: "Lax"
        }))
      );
    }
    if (session.accessToken) {
      await context.setExtraHTTPHeaders({
        Authorization: `Bearer ${session.accessToken}`
      });
    }
  }
};

// src/strategeies/EmailPasswordOtpStrategy.ts
var EmailPasswordOTPStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[EmailPasswordOTP][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START authenticate");
      if (!config2.otpConfig) {
        throw new Error(
          "EmailPasswordOTPStrategy requires otpConfig to be defined in IAuthConfig"
        );
      }
      const otpConfig = config2.otpConfig;
      const otpResolver = new OTPResolver(otpConfig);
      const loginUrl = user.actionUrl ?? config2.actionUrl ?? "";
      const authPageLayout = (user.authPageLayout || config2.authPageLayout) ?? "single-page";
      log(`Resolved loginUrl: ${loginUrl}`);
      if (user.isApi || config2.isApi) {
        log("Entering API auth path");
        const context2 = await this.authenticateViaAPI(
          browser,
          user,
          loginUrl,
          config2
        );
        log("API auth completed");
        const otp2 = await otpResolver.resolve(user);
        log(`OTP resolved (API): ${otp2 ? "YES" : "NO"}`);
        const session = await otpResolver.handleOTPVerification(user, otp2);
        log("OTP verification completed (API)");
        if (session) {
          await this.applySession(context2, session);
          log("Session applied (API)");
        }
        log("AUTH SUCCESS (API)");
        return {
          context: context2,
          metadata: {
            authType: "email-password-otp",
            authPath: "api",
            authPageLayout,
            otpMode: otpConfig.mode,
            username: user.username,
            otpSource: otpConfig.source
          }
        };
      }
      log("Entering browser auth path");
      const overrides = config2.selectors;
      const successUrl = config2.successUrl ?? "**/dashboard**";
      log(`authPageLayout: ${authPageLayout}`);
      log(`successUrl: ${successUrl}`);
      const context = await browser.newContext();
      log("Browser context created");
      const page = await context.newPage();
      log("Page created");
      const authPage = new AuthPage(page, overrides);
      if (otpConfig.source === "api-intercept") {
        log("Starting OTP interception");
        await otpResolver.interceptOTP(page);
        log("OTP interception ready");
      }
      log(`Navigating to login page: ${loginUrl}`);
      await page.goto(loginUrl);
      log("Navigation complete");
      if (authPageLayout === "single-page") {
        log("Single-page login flow");
        await authPage.fillEmail(user.username);
        log("Email filled");
        await authPage.fillPassword(user.password);
        log("Password filled");
        await authPage.submitPassword();
        log("Password submitted");
      } else {
        log("Multi-step login flow");
        await authPage.fillEmail(user.username);
        log("Email filled");
        await authPage.submitEmail();
        log("Email submitted");
        log("Waiting for password field");
        await authPage.passwordField().waitFor({ state: "visible" });
        log("Password field visible");
        await authPage.fillPassword(user.password);
        log("Password filled");
        await authPage.submitPassword();
        log("Password submitted");
      }
      log(`Waiting for OTP (${otpConfig.mode})`);
      await this.waitForOTPByMode(
        authPage,
        otpConfig.mode,
        authPageLayout,
        otpConfig.otpPageUrl
      );
      log("OTP screen detected");
      const otp = await otpResolver.resolve(user);
      log(`OTP resolved: ${otp}`);
      if (otpConfig.mode === "segmented") {
        log("Filling segmented OTP");
        await authPage.fillOTP(
          otp,
          otpConfig.strategy,
          otpConfig.fieldCount ?? 6
        );
        log("Segmented OTP filled");
      } else {
        log("Filling single OTP");
        await authPage.fillOTP(otp);
        log("Single OTP filled");
      }
      if (!otpConfig.autoSubmit) {
        log("Submitting OTP");
        await authPage.submitOTP();
        log("OTP submitted");
      } else {
        log("Auto-submit enabled");
      }
      log(`Waiting for success URL: ${successUrl}`);
      await page.waitForURL(successUrl);
      log("SUCCESS URL reached");
      log("AUTH SUCCESS (BROWSER)");
      return {
        context,
        metadata: {
          authType: "email-password-otp",
          authPath: "browser",
          authPageLayout,
          otpMode: otpConfig.mode,
          otpSource: otpConfig.source,
          username: user.username
        }
      };
    } catch (error) {
      console.error(
        `[EmailPasswordOTP][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error
      );
      throw error;
    }
  }
  async authenticateViaAPI(browser, user, baseUrl, config2) {
    const apiConfig = user.apiConfig ?? config2.apiConfig ?? { path: "" };
    const fieldMap = apiConfig.fieldMap ?? {};
    const url = `${baseUrl}${apiConfig.path}`;
    const body = {
      [fieldMap.username ?? "username"]: user.username,
      [fieldMap.password ?? "password"]: user.password,
      ...apiConfig.additionalFields
    };
    const context = await browser.newContext();
    const response = await context.request.post(url, {
      data: body,
      headers: apiConfig.headers ?? {}
    });
    if (!response.ok()) {
      throw new Error(
        `API auth failed: ${response.status()} ${response.statusText()} : ${url}`
      );
    }
    return context;
  }
  async waitForOTPByMode(authPage, mode, authPageLayout, otpPageUrl) {
    if (authPageLayout === "redirect-to-new-page") {
      await authPage.waitForOTPPage(otpPageUrl ?? "**/otp**");
    }
    if (mode === "segmented") {
      await authPage.waitForOTPMultiField();
    } else {
      await authPage.waitForOTPInline();
    }
  }
  async applySession(context, session) {
    if (session.cookies?.length) {
      await context.addCookies(
        session.cookies.map((cookie) => ({
          name: cookie.key,
          value: cookie.value,
          domain: cookie.domain ?? "",
          path: cookie.path ?? "/",
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: "Lax"
        }))
      );
    }
    if (session.accessToken) {
      await context.setExtraHTTPHeaders({
        Authorization: `Bearer ${session.accessToken}`
      });
    }
  }
};

// src/core/AuthReporter.ts
var AuthReporter = class {
  constructor() {
    this.logs = [];
  }
  attach() {
    authEvents.on("session:saved", ({ filePath, enriched, userId }) => {
      const entry = JSON.stringify({
        event: "session:saved",
        filePath,
        userId,
        savedAt: enriched.metadata?.savedAt,
        origins: enriched.origins?.length ?? 0,
        cookies: enriched.cookies?.length ?? 0
      });
      this.logs.push(entry);
      process.stdout.write(`[smart-auth] ${entry}
`);
    });
    authEvents.on("session:failed", ({ filePath, error }) => {
      const entry = JSON.stringify({
        event: "session:failed",
        filePath,
        error: error.message
      });
      this.logs.push(entry);
      process.stderr.write(`[smart-auth:ERROR] ${entry}
`);
    });
    authEvents.on("session:deleted", ({ filePath }) => {
      this.logs.push(filePath);
      process.stdout.write(`[smart-auth:INFO] ${filePath}
`);
    });
  }
  getLogs() {
    return [...this.logs];
  }
  clear() {
    this.logs = [];
  }
};

// src/strategeies/OAuthStrategy.ts
var PROVIDER_PATTERNS = authConfig?.OAUTHProviderPatterns || {
  google: "**/accounts.google.com/**",
  github: "**/github.com/login/oauth/**",
  microsoft: "**/login.microsoftonline.com/**/authorize**",
  gitlab: "**/gitlab.com/oauth/authorize**",
  facebook: "**/facebook.com/dialog/oauth**",
  linkedin: "**/linkedin.com/oauth/**",
  twitter: "**/twitter.com/i/oauth2/**",
  slack: "**/slack.com/oauth/**",
  okta: "**/*.okta.com/**",
  auth0: "**/*.auth0.com/**"
};
var FALLBACK_PATTERN = "**/{authorize,oauth/authorize,login/oauth}**";
function getInterceptPattern(provider) {
  if (!provider) return FALLBACK_PATTERN;
  return PROVIDER_PATTERNS[provider.toLowerCase()] ?? FALLBACK_PATTERN;
}
var OAuthStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[OAuth][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START OAuth authenticate");
      const successUrl = config2.successUrl ?? "**/dashboard**";
      const serverBase = user.actionUrl ?? config2.BASE_SERVER_URL ?? "http://localhost:3009";
      const oauthProvider = user?.oauthProvider || config2?.oauthProvider;
      const loginUrl = (user.actionUrl ?? config2.actionUrl ?? "") + `?provider=${oauthProvider}`;
      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`provider: ${oauthProvider}`);
      log(`serverBase: ${serverBase}`);
      const context = await browser.newContext();
      log("Browser context created");
      const page = await context.newPage();
      log("Page created");
      const authPage = new AuthPage(page, config2.selectors);
      const pattern = getInterceptPattern(oauthProvider);
      log(`Setting route interception: ${pattern}`);
      await context.route(pattern, async (route) => {
        log("Intercepted OAuth request \u2192 mocking callback");
        await route.fulfill({
          status: 302,
          headers: {
            location: `${serverBase}/auth/oauth/callback?code=mock-oauth-code&state=mock-state`
          }
        });
      });
      log("Route interception active");
      log(`Navigating \u2192 ${loginUrl}`);
      await page.goto(loginUrl);
      log("Login page loaded");
      log(`Waiting for OAuth button: ${oauthProvider}`);
      await authPage.oauthButton(oauthProvider).waitFor({
        state: "visible"
      });
      log("OAuth button visible");
      log("Clicking OAuth button");
      await authPage.oauthButton(oauthProvider).click();
      log("OAuth button clicked");
      log(`Waiting for success URL \u2192 ${successUrl}`);
      await page.waitForURL(successUrl);
      log("SUCCESS URL reached");
      log("AUTH SUCCESS (OAuth)");
      return {
        context,
        metadata: {
          authType: "oauth",
          provider: oauthProvider ?? "unknown",
          mockServerUrl: serverBase,
          username: user.username
        }
      };
    } catch (error) {
      console.error(
        `[OAuth][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error
      );
      throw error;
    }
  }
};

// src/strategeies/OIDCStrategy.ts
var OIDC_PROVIDER_PATTERNS = authConfig?.OIDCProviderPatterns || {
  okta: "**/*.okta.com/oauth2/**/authorize**",
  auth0: "**/*.auth0.com/authorize**",
  keycloak: "**/auth/realms/**/protocol/openid-connect/auth**",
  "azure-ad": "**/login.microsoftonline.com/**/oauth2/v2.0/authorize**",
  cognito: "**/*.auth.*.amazoncognito.com/oauth2/authorize**",
  ping: "**/*.pingidentity.com/as/authorization**"
};
var OIDC_FALLBACK_PATTERN = "**/{authorize,connect/authorize,oauth2/authorize}**";
function getOIDCInterceptPattern(provider) {
  if (!provider) return OIDC_FALLBACK_PATTERN;
  return OIDC_PROVIDER_PATTERNS[provider.toLowerCase()] ?? OIDC_FALLBACK_PATTERN;
}
var OIDCStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[OIDC][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START OIDC authenticate");
      const loginUrl = user.actionUrl ?? config2.actionUrl ?? "";
      const successUrl = config2.successUrl ?? "**/dashboard**";
      const serverBase = user.actionUrl ?? config2.BASE_SERVER_URL ?? "http://localhost:3019";
      const oidcProvider = user?.oidcProvider ?? config2?.oidcProvider;
      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`provider: ${oidcProvider}`);
      log(`serverBase: ${serverBase}`);
      const context = await browser.newContext();
      log("Browser context created");
      const page = await context.newPage();
      log("Page created");
      const authPage = new AuthPage(page, config2.selectors);
      const pattern = getOIDCInterceptPattern(oidcProvider);
      log(`Setting OIDC route interception: ${pattern}`);
      await context.route(pattern, async (route) => {
        log("Intercepted OIDC authorize request \u2192 returning mock callback");
        await route.fulfill({
          status: 302,
          headers: {
            location: `${serverBase}/auth/oidc/callback?code=mock-oidc-code`
          }
        });
      });
      log("Route interception active");
      log(`Navigating \u2192 ${loginUrl}`);
      await page.goto(loginUrl);
      log("Login page loaded");
      log("Clicking SSO button");
      await authPage.ssoButton().click();
      log("SSO button clicked");
      log(`Waiting for success URL \u2192 ${successUrl}`);
      await page.waitForURL(successUrl);
      log("SUCCESS URL reached");
      log("AUTH SUCCESS (OIDC)");
      return {
        context,
        metadata: {
          authType: "oidc",
          provider: oidcProvider ?? "unknown",
          mockServerUrl: serverBase,
          username: user.username
        }
      };
    } catch (error) {
      console.error(
        `[OIDC][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error
      );
      throw error;
    }
  }
};

// src/strategeies/SAMLStrategy.ts
var SAMLStrategy = class {
  async authenticate(browser, user, config2) {
    const started = Date.now();
    const log = (step) => {
      if (!config2.strategyLoggerActive) return;
      console.log(
        `[SAML][${user.username}] ${step} (+${Date.now() - started}ms)`
      );
    };
    try {
      log("START SAML authenticate");
      const samlProvider = user.samlProvider ?? config2.samlProvider;
      const serverBase = user.actionUrl ?? config2.BASE_SERVER_URL ?? "http://localhost:3000";
      const successUrl = config2.successUrl ?? "**/dashboard**";
      const loginUrl = `${serverBase}/auth/saml/login/${encodeURIComponent(user.username)}`;
      log(`provider: ${samlProvider}`);
      log(`serverBase: ${serverBase}`);
      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);
      const context = await browser.newContext();
      log("Browser context created");
      const page = await context.newPage();
      log("Page created");
      log(`Navigating \u2192 ${loginUrl}`);
      await page.goto(loginUrl);
      log("Login page loaded");
      log("Waiting for SAML redirect / callback");
      await page.waitForURL(successUrl);
      log("SUCCESS URL reached");
      log("AUTH SUCCESS (SAML)");
      return {
        context,
        metadata: {
          authType: "saml",
          provider: samlProvider ?? "unknown",
          mockServerUrl: serverBase,
          acsUrl: `${serverBase}/auth/saml/callback`,
          username: user.username
        }
      };
    } catch (error) {
      console.error(
        `[SAML][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error
      );
      throw error;
    }
  }
};

// src/fixtures/base.fixtures.ts
var import_test = require("@playwright/test");
var import_test2 = require("@playwright/test");
var test = import_test.test.extend({
  authManager: async ({}, use) => {
    await use(await getOrCreateAuthManager());
  },
  authConfig: async ({ authManager }, use) => {
    await use(authManager.authConfig);
  },
  getUserConfig: async ({ authManager }, use) => {
    await use(
      (username) => authManager.getUserEffectiveConfig(username)
    );
  },
  //if feel it s Better to let playwright handle contexts, but if need be here you go
  // Use this only if u want pwmaf to handle token expiration automatically
  getContext: async ({ browser, authManager }, use) => {
    const contexts = [];
    await use(async (username) => {
      const context = await authManager.getContext(username, browser);
      contexts.push(context);
      return context;
    });
    await Promise.allSettled(contexts.map((ctx) => ctx.close()));
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthFactory,
  AuthManager,
  AuthPage,
  AuthReporter,
  ConfigValidationError,
  EmailOTPStrategy,
  EmailPasswordOTPStrategy,
  EmailPasswordStrategy,
  OAuthStrategy,
  OIDCStrategy,
  SAMLStrategy,
  authConfig,
  authEvents,
  authFile,
  buildApiUrl,
  deleteAuthStore,
  ensureValidSession,
  expect,
  extractToken,
  getOrCreateAuthManager,
  getTokenFromFile,
  isTokenExpired,
  test,
  validateConfig,
  validateUserEndpoints
});
