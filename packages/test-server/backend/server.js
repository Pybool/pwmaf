/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Test auth server for QA framework.
 * Supports: email-password, email-otp, email-password-otp, oauth, oidc, saml
 *
 * Endpoints added vs original:
 *   GET  /health          — liveness probe; used by Docker healthcheck + CI wait-on
 *   GET  /api/echo-headers — returns all inbound request headers as JSON;
 *                            used by token-storage.spec.ts to verify header injection
 */

require("dotenv").config();
const express      = require("express");
const jwt          = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors         = require("cors");
const path         = require("path");

const { generateSamlKeypair, mountSamlRoutes } = require("./saml-mock");

const app      = express();
const PORT     = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const SAML_KEYS = generateSamlKeypair();
console.log("[SAML] Keypair generated ✓");

// ── Server config ─────────────────────────────────────────────────────────────
const serverConfig = {
  AUTH_TYPE:          process.env.AUTH_TYPE          || "email-password",
  AUTH_FLOW:          process.env.AUTH_FLOW          || "single-page",
  TOKEN_TYPE:         process.env.TOKEN_TYPE         || "cookie",
  OTP_UX_MODE:        process.env.OTP_UX_MODE        || "single-input",
  CUSTOM_HEADER_NAME: process.env.CUSTOM_HEADER_NAME || "X-Auth-Token",
  BASE_URL:           process.env.BASE_URL,
};

const ALLOWED_AUTH_TYPES   = ["email-password", "email-otp", "email-password-otp", "oauth", "oidc", "saml", "custom"];
const ALLOWED_AUTH_FLOWS   = ["single-page", "progressive-reveal"];
const ALLOWED_TOKEN_TYPES  = ["cookie", "bearer", "custom-header"];
const ALLOWED_OTP_UX_MODES = ["single-input", "segmented", "redirect-to-new-page"];

// ── Users ─────────────────────────────────────────────────────────────────────
const USERS = [
  // email-password
  { email: "user@test.com",    password: "password123", role: "user"  },
  { email: "admin@test.com",   password: "admin123",    role: "admin" },
  // email-otp
  { email: "otp-user@test.com",   role: "user"  },
  { email: "otp-admin@test.com",  role: "admin" },
  // hybrid (email-password-otp)
  { email: "hybrid-user@test.com",  password: "password123", role: "user"  },
  { email: "hybrid-admin@test.com", password: "admin123",    role: "admin" },
  // bearer / custom-header
  { email: "bearer-user@test.com", password: "password123", role: "user" },
  { email: "header-user@test.com", password: "password123", role: "user" },
  // oauth
  { email: "google-user@gmail.com", role: "admin" },
  { email: "oauth-ef@gmail.com",    role: "admin" },
  // oidc
  { email: "oidc-user@example.com", role: "user" },
  // otp flow variants
  { email: "otp-sp-page@test.com",  role: "user" },
  { email: "otp-ef-page@test.com",  role: "user" },
  { email: "otp-sp-multi@test.com", role: "user" },
  { email: "otp-ef-multi@test.com", role: "user" },
  // hybrid flow variants
  { email: "hybrid-sp-page@test.com",  password: "password123", role: "user" },
  { email: "hybrid-ef-page@test.com",  password: "password123", role: "user" },
  { email: "hybrid-sp-multi@test.com", password: "password123", role: "user" },
  { email: "hybrid-ef-multi@test.com", password: "password123", role: "user" },
  // SAML users
  { email: "saml-user@example.com",   role: "user"  },
  { email: "saml-admin@example.com",  role: "admin" },
  { email: "saml-entra@example.com",  role: "user",  firstName: "Entra",  lastName: "User"  },
  { email: "saml-okta@example.com",   role: "admin", firstName: "Okta",   lastName: "Admin" },
  { email: "saml-custom@example.com", role: "user",  firstName: "Custom", lastName: "User"  },
  // localStorage / sessionStorage token-storage test users (port 3018)
  { email: "ls-bearer@example.com",  password: "password123", role: "user" },
  { email: "ss-bearer@example.com",  password: "password123", role: "user" },
];

const otpStore = new Map();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, "frontend")));

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(email) {
  const otp = generateOTP();
  otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });
  return otp;
}

function sendToken(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

  res.cookie("auth_token", token, { httpOnly: true, maxAge: 3_600_000, sameSite: "lax" });

  if (serverConfig.TOKEN_TYPE === "bearer") {
    return res.json({ success: true, accessToken: token });
  }
  if (serverConfig.TOKEN_TYPE === "custom-header") {
    return res.json({ success: true, [serverConfig.CUSTOM_HEADER_NAME]: token });
  }
  return res.json({ success: true });
}

function authenticate(req, res, next) {
  let token;

  if (serverConfig.TOKEN_TYPE === "bearer") {
    const auth = req.headers.authorization;
    token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  } else if (serverConfig.TOKEN_TYPE === "custom-header") {
    token = req.headers[serverConfig.CUSTOM_HEADER_NAME.toLowerCase()];
  }

  token = token ?? req.cookies.auth_token;

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── Health probe ──────────────────────────────────────────────────────────────
// Used by Docker HEALTHCHECK and CI wait-on.
// Always returns 200 as long as the process is alive.
app.get("/health", (_, res) => {
  res.json({
    status:   "ok",
    port:     PORT,
    authType: serverConfig.AUTH_TYPE,
    authFlow: serverConfig.AUTH_FLOW,
    tokenType: serverConfig.TOKEN_TYPE,
  });
});

// ── Echo headers ──────────────────────────────────────────────────────────────
// Returns every inbound HTTP header as a JSON object.
// Used by token-storage.spec.ts to assert that Authorization / custom headers
// were injected by AuthManager.getContext() when tokenStorageConfig is set.
// This endpoint is intentionally NOT protected — the test verifies header
// presence from the outside without needing a valid session.
app.get("/api/echo-headers", (req, res) => {
  res.json(req.headers);
});

// ── Config endpoints ──────────────────────────────────────────────────────────
app.get("/api/config", (_, res) => {
  res.json({
    authType:         serverConfig.AUTH_TYPE,
    authFlow:         serverConfig.AUTH_FLOW,
    tokenType:        serverConfig.TOKEN_TYPE,
    otpUxMode:        serverConfig.OTP_UX_MODE,
    customHeaderName: serverConfig.CUSTOM_HEADER_NAME,
  });
});

app.post("/api/config", (req, res) => {
  const { AUTH_TYPE, AUTH_FLOW, TOKEN_TYPE, OTP_UX_MODE, CUSTOM_HEADER_NAME } = req.body;
  const errors = [];

  if (AUTH_TYPE !== undefined) {
    if (!ALLOWED_AUTH_TYPES.includes(AUTH_TYPE))
      errors.push(`Invalid AUTH_TYPE "${AUTH_TYPE}". Allowed: ${ALLOWED_AUTH_TYPES.join(", ")}`);
    else serverConfig.AUTH_TYPE = AUTH_TYPE;
  }
  if (AUTH_FLOW !== undefined) {
    if (!ALLOWED_AUTH_FLOWS.includes(AUTH_FLOW))
      errors.push(`Invalid AUTH_FLOW "${AUTH_FLOW}". Allowed: ${ALLOWED_AUTH_FLOWS.join(", ")}`);
    else serverConfig.AUTH_FLOW = AUTH_FLOW;
  }
  if (TOKEN_TYPE !== undefined) {
    if (!ALLOWED_TOKEN_TYPES.includes(TOKEN_TYPE))
      errors.push(`Invalid TOKEN_TYPE "${TOKEN_TYPE}". Allowed: ${ALLOWED_TOKEN_TYPES.join(", ")}`);
    else serverConfig.TOKEN_TYPE = TOKEN_TYPE;
  }
  if (OTP_UX_MODE !== undefined) {
    if (!ALLOWED_OTP_UX_MODES.includes(OTP_UX_MODE))
      errors.push(`Invalid OTP_UX_MODE "${OTP_UX_MODE}". Allowed: ${ALLOWED_OTP_UX_MODES.join(", ")}`);
    else serverConfig.OTP_UX_MODE = OTP_UX_MODE;
  }
  if (CUSTOM_HEADER_NAME !== undefined) {
    if (typeof CUSTOM_HEADER_NAME !== "string" || !CUSTOM_HEADER_NAME.trim())
      errors.push("CUSTOM_HEADER_NAME must be a non-empty string");
    else serverConfig.CUSTOM_HEADER_NAME = CUSTOM_HEADER_NAME.trim();
  }

  if (errors.length > 0) return res.status(400).json({ errors });
  res.json({ success: true, config: { ...serverConfig } });
});

app.post("/api/config/reset", (_, res) => {
  serverConfig.AUTH_TYPE          = process.env.AUTH_TYPE          || "email-password";
  serverConfig.AUTH_FLOW          = process.env.AUTH_FLOW          || "single-page";
  serverConfig.TOKEN_TYPE         = process.env.TOKEN_TYPE         || "cookie";
  serverConfig.OTP_UX_MODE        = process.env.OTP_UX_MODE        || "single-input";
  serverConfig.CUSTOM_HEADER_NAME = process.env.CUSTOM_HEADER_NAME || "X-Auth-Token";
  res.json({ success: true, config: { ...serverConfig } });
});

// ── Auth endpoints ────────────────────────────────────────────────────────────
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  if (serverConfig.AUTH_TYPE === "email-password-otp") {
    const otp = storeOTP(email);
    return res.json({ requiresOTP: true, otp, message: "OTP sent" });
  }

  sendToken(res, { email: user.email, role: user.role });
});

app.post("/auth/request-otp", (req, res) => {
  const { email } = req.body;
  const user = USERS.find((u) => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const otp = storeOTP(email);
  res.json({ success: true, otp, message: "OTP sent" });
});

app.get("/auth/get-otp/:username", (req, res) => {
  const stored = otpStore.get(req.params.username);
  if (!stored)               return res.status(404).json({ error: "No OTP found" });
  if (Date.now() > stored.expires) return res.status(410).json({ error: "OTP expired" });
  res.json({ data: { otp: stored.otp } });
});

app.post("/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore.get(email);

  if (!stored)               return res.status(400).json({ error: "No OTP found" });
  if (Date.now() > stored.expires) return res.status(400).json({ error: "OTP expired" });
  if (stored.otp !== otp)   return res.status(401).json({ error: "Invalid OTP" });

  otpStore.delete(email);
  const user = USERS.find((u) => u.email === email);
  sendToken(res, { email, role: user?.role ?? "user" });
});

// ── OAuth / OIDC ──────────────────────────────────────────────────────────────
app.get("/auth/oauth/authorize", (req, res) => {
  res.redirect(
    `${serverConfig.BASE_URL}/auth/oauth/callback?code=mock-oauth-code&state=mock-state`,
  );
});
app.get("/auth/google", (req, res) => res.redirect("/auth/oauth/authorize"));
app.get("/auth/oauth/callback", (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");

  const mockUser = { email: "google-user@gmail.com", role: "admin" };
  const token    = jwt.sign(mockUser, JWT_SECRET, { expiresIn: "1h" });
  res.cookie("auth_token", token, { httpOnly: true, maxAge: 3_600_000, sameSite: "lax" });
  res.redirect(
    `/dashboard.html?token=${token}&tokenType=${serverConfig.TOKEN_TYPE}&headerName=${serverConfig.CUSTOM_HEADER_NAME}`,
  );
});

app.get("/auth/oidc/authorize", (req, res) =>
  res.redirect(`/auth/oidc/callback?code=mock-oidc-code`),
);
app.get("/auth/oidc/callback", (req, res) => {
  const mockUser = { email: "oidc-user@example.com", role: "user" };
  const token    = jwt.sign(mockUser, JWT_SECRET, { expiresIn: "1h" });
  res.cookie("auth_token", token, { httpOnly: true, maxAge: 3_600_000, sameSite: "lax" });
  res.redirect(
    `/dashboard.html?token=${token}&tokenType=${serverConfig.TOKEN_TYPE}&headerName=${serverConfig.CUSTOM_HEADER_NAME}`,
  );
});

// ── SAML routes ───────────────────────────────────────────────────────────────
mountSamlRoutes(app, {
  baseUrl:   BASE_URL,
  jwtSecret: JWT_SECRET,
  keys:      SAML_KEYS,
  users:     USERS,
  onSuccess: (res, user, { relayState } = {}) => {
    const token = jwt.sign(
      { email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.cookie("auth_token", token, { httpOnly: true, maxAge: 3_600_000, sameSite: "lax" });

    if (serverConfig.TOKEN_TYPE === "bearer") {
      return res.json({ success: true, accessToken: token });
    }
    if (serverConfig.TOKEN_TYPE === "custom-header") {
      return res.json({ success: true, [serverConfig.CUSTOM_HEADER_NAME]: token });
    }
    res.redirect(relayState || "/dashboard.html");
  },
});

// ── Protected endpoints ───────────────────────────────────────────────────────
app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post("/auth/logout", (_, res) => {
  res.clearCookie("auth_token");
  res.json({ success: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nAuth server → http://localhost:${PORT}`);
  console.log(`AUTH_TYPE: ${serverConfig.AUTH_TYPE} | AUTH_FLOW: ${serverConfig.AUTH_FLOW} | TOKEN_TYPE: ${serverConfig.TOKEN_TYPE} | OTP_UX_MODE: ${serverConfig.OTP_UX_MODE}`);
  console.log(`\nRoutes: /health  /api/echo-headers  /api/me  /api/config`);
  console.log(`SAML IdP metadata: ${BASE_URL}/saml/idp/metadata`);
});
