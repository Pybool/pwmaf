# Auth Test App

Minimal Express + vanilla HTML app for testing all Playwright auth strategies.

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm start
```

App runs at http://localhost:3000

## Test Users

| Email | Password | Role |
|---|---|---|
| user@test.com | password123 | user |
| admin@test.com | admin123 | admin |

## Auth Combinations

Control behaviour entirely via `.env`:

### email-password / single-page / cookie
```
AUTH_TYPE=email-password
AUTH_FLOW=single-page
TOKEN_TYPE=cookie
```

### email-password / email-first / bearer
```
AUTH_TYPE=email-password
AUTH_FLOW=email-first
TOKEN_TYPE=bearer
```

### email-otp / single-page
```
AUTH_TYPE=email-otp
AUTH_FLOW=single-page
TOKEN_TYPE=cookie
```
OTP appears inline after email blur. No submit button for email step.

### email-otp / email-first
```
AUTH_TYPE=email-otp
AUTH_FLOW=email-first
TOKEN_TYPE=cookie
```

### email-password-otp (2FA) / single-page
```
AUTH_TYPE=email-password-otp
AUTH_FLOW=single-page
TOKEN_TYPE=cookie
```

### email-password-otp / email-first
```
AUTH_TYPE=email-password-otp
AUTH_FLOW=email-first
TOKEN_TYPE=cookie
```

### google-oauth
```
AUTH_TYPE=google-oauth
TOKEN_TYPE=cookie
```

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /api/config | Returns active auth config |
| POST | /auth/login | email+password login |
| POST | /auth/request-otp | Trigger OTP send (returns OTP in response body for api-intercept) |
| GET | /auth/get-otp/:username | Fetch OTP directly (for api-request source) |
| POST | /auth/verify-otp | Submit OTP, receive session |
| GET | /auth/google | Start Google OAuth mock |
| GET | /auth/google/callback | Google OAuth callback |
| GET | /api/me | Protected — returns current user |
| POST | /auth/logout | Clear session |

## OTP Sources

**env**: set `TEST_OTP=123456` in env, configure `source: "env"` in Playwright config

**api-intercept**: `POST /auth/request-otp` returns `{ otp }` in response body.
Configure `interceptPattern: "**/auth/request-otp**"` in Playwright config.

**api-request**: `GET /auth/get-otp/:username` returns `{ otp }`.
Configure `requestConfig.path: "/auth/get-otp/{username}"` in Playwright config.

## Custom Header

```
TOKEN_TYPE=custom-header
CUSTOM_HEADER_NAME=X-Session-Key
```

Frontend stores the token from the response and sends it back as `X-Session-Key` header.
