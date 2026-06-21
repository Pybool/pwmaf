## What does this PR do?

<!-- Describe the change in one or two sentences. -->

## Type of change

- [ ] Bug fix
- [ ] New feature / strategy
- [ ] Config / type change
- [ ] Documentation only
- [ ] Refactor (no behaviour change)

## Test file checklist

**Every PR that touches source code must include or update a corresponding test file.**
The table below maps framework areas to their spec file. Tick the row(s) that apply
to your change and confirm the spec file was updated.

| Area changed | Spec file required |
|---|---|
| `AuthFactory` | `tests/strategies/auth-factory.spec.ts` |
| `EmailPasswordStrategy` (browser) | `tests/strategies/email-password.browser.spec.ts` |
| `EmailPasswordStrategy` (API) | `tests/strategies/email-password.api.spec.ts` |
| `EmailOTPStrategy` (browser) | `tests/strategies/email-otp.browser.spec.ts` |
| `EmailOTPStrategy` (API) | `tests/strategies/email-otp.api.spec.ts` |
| `EmailPasswordOTPStrategy` (browser) | `tests/strategies/email-password-otp.browser.spec.ts` |
| `EmailPasswordOTPStrategy` (API) | `tests/strategies/email-password-otp.api.spec.ts` |
| `OAuthStrategy` | `tests/strategies/oauth.spec.ts` |
| `OIDCStrategy` | `tests/strategies/oidc.spec.ts` |
| `SAMLStrategy` | `tests/strategies/saml.spec.ts` |
| Custom strategy extension point | `tests/strategies/custom-strategy.spec.ts` |
| `AuthManager` (setup / teardown / getContext) | `tests/core/auth-manager.spec.ts` |
| `OTPResolver` | `tests/core/otp-resolver.spec.ts` |
| `tokenStorage` / `TokenStorageConfig` | `tests/core/token-storage.spec.ts` |
| `validate-config` / `ConfigValidationError` | `tests/core/config-validation.spec.ts` |
| `authEvents` / `AuthReporter` | `tests/core/auth-events.spec.ts` |
| Session persistence / storageState shape | `tests/session/persistence.spec.ts` |
| Session integrity (`/api/me`) | `tests/session/integrity.spec.ts` |
| Session isolation / cross-contamination | `tests/session/isolation.spec.ts` |
| Session expiry / stale file handling | `tests/session/expiry.spec.ts` |
| API error paths | `tests/error-paths/api-errors.spec.ts` |
| `IAuthConfig` / `IUser` types | `tests/core/config-validation.spec.ts` |

- [ ] I have added or updated the relevant spec file(s) listed above
- [ ] New tests cover the happy path AND at least one error path
- [ ] `npm run typecheck` passes locally
- [ ] `npm test` (Jest unit tests) passes locally

## Breaking changes?

- [ ] No
- [ ] Yes — describe the migration path below:

<!-- If yes, describe what callers need to change. -->

## Related issue(s)

Closes #
