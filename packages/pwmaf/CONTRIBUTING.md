# Contributing to qa-pwmaf

## Branch model

```
master ← staging ← develop ← feature/your-branch
```

- All work starts from `develop`
- PRs merge `develop → staging`, then `staging → master`
- **`master` and `staging` are protected** — CI must pass before any merge is allowed
- Direct pushes to `master` or `staging` are blocked

---

## Before you open a PR

```bash
npm ci
npm run typecheck      # must pass with zero errors
npm test               # Jest unit tests — must all pass
npx playwright test    # integration tests — must all pass locally
```

---

## Mandatory test file rule

**Every PR that touches source code must include or update a test file.**  
This is enforced by the PR checklist and verified in code review.  
PRs without matching test updates will not be merged.

### Which file do I need to update?

| Source area | Test file |
|---|---|
| `src/core/AuthFactory.ts` | `tests/strategies/auth-factory.spec.ts` |
| `src/strategeies/EmailPasswordStrategy.ts` (browser) | `tests/strategies/email-password.browser.spec.ts` |
| `src/strategeies/EmailPasswordStrategy.ts` (API) | `tests/strategies/email-password.api.spec.ts` |
| `src/strategeies/EmailOTPStrategy.ts` (browser) | `tests/strategies/email-otp.browser.spec.ts` |
| `src/strategeies/EmailOTPStrategy.ts` (API) | `tests/strategies/email-otp.api.spec.ts` |
| `src/strategeies/EmailPasswordOTPStrategy.ts` (browser) | `tests/strategies/email-password-otp.browser.spec.ts` |
| `src/strategeies/EmailPasswordOTPStrategy.ts` (API) | `tests/strategies/email-password-otp.api.spec.ts` |
| `src/strategeies/OAuthStrategy.ts` | `tests/strategies/oauth.spec.ts` |
| `src/strategeies/OIDCStrategy.ts` | `tests/strategies/oidc.spec.ts` |
| `src/strategeies/SAMLStrategy.ts` | `tests/strategies/saml.spec.ts` |
| Custom strategy extension point (`IAuthStrategy`) | `tests/strategies/custom-strategy.spec.ts` |
| `src/core/AuthManager.ts` | `tests/core/auth-manager.spec.ts` |
| `src/core/OtpResolver.ts` | `tests/core/otp-resolver.spec.ts` |
| `src/utils/tokenStorage.ts` / `TokenStorageConfig` | `tests/core/token-storage.spec.ts` |
| `src/configs/validate-config.ts` / `ConfigValidationError` | `tests/core/config-validation.spec.ts` |
| `src/core/AuthEvents.ts` / `src/core/AuthReporter.ts` | `tests/core/auth-events.spec.ts` |
| Session file shape / `EnrichedStorageState` | `tests/session/persistence.spec.ts` |
| `/api/me` integrity / role assertions | `tests/session/integrity.spec.ts` |
| Session isolation / cross-contamination | `tests/session/isolation.spec.ts` |
| Session expiry / stale file handling | `tests/session/expiry.spec.ts` |
| API strategy error paths | `tests/error-paths/api-errors.spec.ts` |
| `src/types.ts` | Whichever spec exercises the changed type |

### What does "update a test file" mean?

1. **New feature** → add new `test()` blocks inside the relevant spec file
2. **Bug fix** → add a regression test that would have caught the bug
3. **Type/interface change** → update the test that exercises that type; add a new test if the change introduces new validation rules
4. **Rename / restructure** → update imports and descriptions in the relevant spec

Every test update must cover at minimum:
- The **happy path** (the thing that should work, works)
- At least one **error path** (the thing that should fail, fails with the right error)

---

## Adding a new auth strategy

If you're adding a new strategy (e.g. `MagicLinkStrategy`), create **two new spec files**:

```
tests/strategies/magic-link.browser.spec.ts   ← browser flow
tests/strategies/magic-link.api.spec.ts       ← API path (if isApi: true is supported)
```

Add the strategy to the table in this file, the PR template, and the README.

Also update `tests/strategies/auth-factory.spec.ts` to assert that
`AuthFactory.getStrategy({ authType: "magic-link" })` returns your new class.

---

## Test file structure conventions

Each spec file follows this pattern:

```typescript
/**
 * <filename>.spec.ts — <area> (<section refs>)
 *
 * WHAT THIS FILE TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  §N  Section title — what is verified and why
 */

// shared helper functions (u(), eff(), runStrategy(), etc.)

test.describe("§N Section Title", () => {
  test("scenario: expected outcome", async ({ browser, authConfig }) => {
    // arrange
    // act
    // assert — always end with at least one expect()
  });
});
```

Rules:
- **One `test.describe` per numbered section** (`§1`, `§2`, etc.)
- **Test titles state the scenario and the expected outcome** — not what the code does
- **No `test.only`** in committed code — it blocks the entire suite
- **No `test.skip`** without a linked issue number in a comment

---

## CI pipeline

```
typecheck → unit (Jest) → build → E2E (strategies / api / session / core)
                                         ↓
                                  all-checks-pass  ←── branch protection points here
```

Every PR must pass the `all-checks-pass` job before it can merge.  
The `release.yml` workflow publishes to npm **only** after `all-checks-pass` succeeds on `master`.

### Running a specific CI slice locally

```bash
# strategies only
npx playwright test tests/strategies/

# API mode
USE_API=true npx playwright test tests/strategies/ tests/error-paths/

# core utilities (no browser needed for unit tests)
npm test -- tests/core/config-validation.spec.ts
npm test -- tests/core/auth-events.spec.ts
```

---

## Coverage gaps to be aware of

The following areas currently have reduced or partial coverage.  
If your PR touches these, adding tests is especially appreciated:

| Area | Gap |
|---|---|
| `hidden-input` OTP strategy | Only structural tests — needs a mock server page with `autocomplete="one-time-code"` |
| `TokenStorageConfig` header injection | Integration tests rely on `/api/echo-headers` endpoint not yet in all mocks |
| `AuthReporter.attach()` idempotency | Documented as "at most 2" — needs enforcement and a hard assertion |
| `authFile()` utility | Used everywhere, never unit-tested directly |
| `buildApiUrl()` | Edge cases (path included in origin) untested |
| CLI (`pwmaf init`) | Zero tests — any CLI change should add a test |

---

## Commit style

```
feat: add hidden-input OTP strategy
fix: restore sessionStorage on context creation
test: add token-storage coverage for dot-notation tokenPath
docs: update README with TokenStorageConfig section
chore: bump version to 0.2.10
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`
