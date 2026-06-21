# AUTH_MATRIX — Playwright test suite

This package is the `tests.zip` content converted to run entirely on the
Playwright test runner (no Jest). It includes its own `package.json`,
`playwright.config.ts`, and `tsconfig.json` so it can run standalone.

## What changed from the original archive

Two files used bare Jest globals and have been rewritten to use Playwright's
`test`/`test.describe` API:

- **`tests/core/auth-events.spec.ts`**
  - `describe` → `test.describe`
  - `beforeAll` / `afterEach` → `test.beforeAll` / `test.afterEach`
  - Jest's `(done) => {...}` async-callback pattern (used for EventEmitter
    listener assertions) was rewritten to synchronous assertions, since
    `authEvents.emit(...)` calls listeners synchronously — no `done()` callback
    is needed under Playwright's test runner.

- **`tests/core/config-validation.spec.ts`**
  - All eight `describe(...)` blocks → `test.describe(...)`
  - Added `import { test, expect } from "@playwright/test";`

- **`tests/core/otp-resolver.spec.ts`**
  - Normalized its import path from `"../../fixtures"` to
    `"../../fixtures/base.fixtures"` to match every other spec file in the
    suite (it was already written against Playwright's `test`/`expect`, just
    importing from a non-standard path).

Every other `*.spec.ts` file in the archive already used
`test`/`test.describe` from `../../fixtures/base.fixtures` (a Playwright
fixtures file) and needed no changes.

## What this package does NOT include

The zip you provided contains only the `tests/` directory. The specs import
several modules that live in the rest of your project and are **not**
included here — this package assumes they already exist alongside `tests/`
at the project root:

- `core/`, `configs/`, `types/`, `utils/`, `strategies/` — the framework
  source referenced via relative imports (e.g. `../../core`,
  `../../configs/validate-config`).
- `fixtures/base.fixtures.ts` — the custom Playwright fixtures file
  providing `authConfig`, `authManager`, `getContext`, etc.
- The `qa-pwmaf` package (`AuthFactory`, `EmailOTPStrategy`, strategy
  classes, `IUser`/`IAuthConfig` types) — imported as a package, so it should
  be linked or published for `npm install` to resolve it. The `dependencies`
  entry in `package.json` uses `"*"` as a placeholder — point it at your
  actual registry/path/tarball.
- `global-setup.ts` and `docker-compose.yml` (your 18-container mock server
  setup) — `playwright.config.ts` references `./global-setup.ts` via
  `globalSetup`; drop your existing file in at the project root.

## Running

```bash
npm install
npm run install:browsers   # first time only
npm test                   # runs both "unit" and "browser" projects
npm run test:unit          # auth-events, config-validation, auth-factory only
npm run test:browser       # everything else (requires the mock containers up)
```

`playwright.config.ts` splits specs into two projects:

- **unit** — `auth-events.spec.ts`, `config-validation.spec.ts`,
  `auth-factory.spec.ts` (no browser, no mock servers required).
- **browser** — everything else, running against Chromium and your 18 mock
  auth containers.
