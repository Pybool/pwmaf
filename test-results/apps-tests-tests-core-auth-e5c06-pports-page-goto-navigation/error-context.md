# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\tests\tests\core\auth-manager.spec.ts >> §13 getContext fixture behaviour >> context from getContext() supports page.goto navigation
- Location: apps\tests\tests\core\auth-manager.spec.ts:103:7

# Error details

```
Error: [auth-config] Missing base.config.ts or base.config.js in project root.
Expected: C:\Users\emmanuel\Documents\pwmaf\base.config.ts
```

# Test source

```ts
  499 |         return this.fillOTPSingle(otp);
  500 |       }
  501 |     }
  502 |   }
  503 |   async fillOTPSingle(otp) {
  504 |     await this.otpSingleField("single-input").fill(otp);
  505 |   }
  506 |   async fillOTPMulti(otp, fieldCount = 6) {
  507 |     const digits = otp.split("").slice(0, fieldCount);
  508 |     const fields = this.otpMultiFields();
  509 |     for (let i = 0; i < digits.length; i++) {
  510 |       const input = fields.nth(i);
  511 |       await input.waitFor({ state: "visible" });
  512 |       await input.click();
  513 |       await input.fill(digits[i]);
  514 |       const nextInput = fields.nth(i + 1);
  515 |       const nextVisible = i + 1 < digits.length ? await nextInput.isVisible().catch(() => false) : false;
  516 |       if (nextVisible) {
  517 |         const isFocused = await nextInput.evaluate(
  518 |           (el) => el === document.activeElement
  519 |         ).catch(() => false);
  520 |         if (!isFocused) {
  521 |           await input.press("Tab");
  522 |         }
  523 |       }
  524 |     }
  525 |   }
  526 |   async submitEmail() {
  527 |     await this.emailSubmitButton().click();
  528 |   }
  529 |   async submitPassword() {
  530 |     await this.passwordSubmitButton().click();
  531 |   }
  532 |   async submitOTP() {
  533 |     await this.otpSubmitButton().click();
  534 |   }
  535 |   async waitForOTPInline(strategy = "single-input") {
  536 |     if (strategy === "multi-input") {
  537 |       await this.otpMultiFields().first().waitFor({ state: "visible" });
  538 |     } else {
  539 |       const state = strategy === "hidden-input" ? "attached" : "visible";
  540 |       await this.otpSingleField(strategy).waitFor({ state });
  541 |     }
  542 |   }
  543 |   async waitForOTPPage(urlPattern) {
  544 |     await this.page.waitForURL(urlPattern);
  545 |   }
  546 |   async waitForOTPMultiField() {
  547 |     await this.otpMultiFields().first().waitFor({ state: "visible" });
  548 |   }
  549 | };
  550 | 
  551 | // src/utils/helpers.ts
  552 | var import_promises2 = __toESM(require("fs/promises"));
  553 | 
  554 | // src/configs/_auth.config.ts
  555 | var import_fs = __toESM(require("fs"));
  556 | var import_path = __toESM(require("path"));
  557 | var dotenv = __toESM(require_main());
  558 | dotenv.config();
  559 | function findProjectRoot(startDir = process.cwd()) {
  560 |   let dir = import_path.default.resolve(startDir);
  561 |   while (true) {
  562 |     const pkg = import_path.default.join(dir, "package.json");
  563 |     if (import_fs.default.existsSync(pkg)) {
  564 |       return dir;
  565 |     }
  566 |     const parent = import_path.default.dirname(dir);
  567 |     if (parent === dir) {
  568 |       throw new Error(
  569 |         `[auth-config] Cannot locate project root (no package.json found above "${startDir}")`
  570 |       );
  571 |     }
  572 |     dir = parent;
  573 |   }
  574 | }
  575 | function registerTsNode(projectRoot) {
  576 |   const tsNodeModule = require.resolve("ts-node", {
  577 |     paths: [projectRoot]
  578 |   });
  579 |   try {
  580 |     require(tsNodeModule).register({
  581 |       transpileOnly: true,
  582 |       files: false,
  583 |       compilerOptions: {
  584 |         module: "commonjs"
  585 |       }
  586 |     });
  587 |   } catch (err) {
  588 |     throw new Error(
  589 |       `[auth-config] Failed to register ts-node.
  590 | ${err.message}`
  591 |     );
  592 |   }
  593 | }
  594 | function loadAuthConfigFile(projectRoot) {
  595 |   const tsPath = import_path.default.join(projectRoot, "base.config.ts");
  596 |   const jsPath = import_path.default.join(projectRoot, "base.config.js");
  597 |   const configPath = import_fs.default.existsSync(tsPath) ? tsPath : import_fs.default.existsSync(jsPath) ? jsPath : null;
  598 |   if (!configPath) {
> 599 |     throw new Error(
      |           ^ Error: [auth-config] Missing base.config.ts or base.config.js in project root.
  600 |       `[auth-config] Missing base.config.ts or base.config.js in project root.
  601 | Expected: ${tsPath}`
  602 |     );
  603 |   }
  604 |   if (configPath.endsWith(".ts")) {
  605 |     registerTsNode(projectRoot);
  606 |   }
  607 |   let mod;
  608 |   try {
  609 |     mod = require(configPath);
  610 |   } catch (err) {
  611 |     throw new Error(
  612 |       `[auth-config] Failed to load config: "${configPath}"
  613 | ${err.message}`
  614 |     );
  615 |   }
  616 |   const config2 = mod?.default ?? mod?.BASE_CONFIG ?? mod;
  617 |   if (!config2 || typeof config2 !== "object") {
  618 |     throw new Error(
  619 |       `[auth-config] Invalid config export in "${configPath}".
  620 | Expected: export const BASE_CONFIG or export default`
  621 |     );
  622 |   }
  623 |   return config2;
  624 | }
  625 | function loadJsonFile(filePath) {
  626 |   if (!import_fs.default.existsSync(filePath)) {
  627 |     return [];
  628 |   }
  629 |   try {
  630 |     const raw = import_fs.default.readFileSync(filePath, "utf-8");
  631 |     const parsed = JSON.parse(raw);
  632 |     if (!Array.isArray(parsed)) {
  633 |       throw new Error("Users JSON must be an array");
  634 |     }
  635 |     return parsed;
  636 |   } catch (err) {
  637 |     throw new Error(
  638 |       `[auth-config] Failed to parse users JSON: "${filePath}"
  639 | ${err.message}`
  640 |     );
  641 |   }
  642 | }
  643 | async function createAuthConfig(usersPath) {
  644 |   if (!usersPath) {
  645 |     throw new Error("[auth-config] usersPath is required");
  646 |   }
  647 |   const projectRoot = findProjectRoot();
  648 |   const config2 = loadAuthConfigFile(projectRoot);
  649 |   const absoluteUsersPath = import_path.default.resolve(projectRoot, usersPath);
  650 |   const users = loadJsonFile(absoluteUsersPath);
  651 |   if (process.env.VALIDATE_USER_URLS === "1") {
  652 |     await validateUserEndpoints(users);
  653 |   }
  654 |   return {
  655 |     ...config2,
  656 |     users
  657 |   };
  658 | }
  659 | 
  660 | // src/core/AuthFactory.ts
  661 | var import_fs2 = __toESM(require("fs"));
  662 | var import_path2 = __toESM(require("path"));
  663 | 
  664 | // src/core/AuthEvents.ts
  665 | var import_events = require("events");
  666 | var AuthEventEmitter = class extends import_events.EventEmitter {
  667 |   emit(event, ...args) {
  668 |     return super.emit(event, ...args);
  669 |   }
  670 |   on(event, listener) {
  671 |     return super.on(event, listener);
  672 |   }
  673 |   once(event, listener) {
  674 |     return super.once(event, listener);
  675 |   }
  676 |   off(event, listener) {
  677 |     return super.off(event, listener);
  678 |   }
  679 | };
  680 | var authEvents = new AuthEventEmitter();
  681 | 
  682 | // src/core/AuthFactory.ts
  683 | var AuthFactory = class {
  684 |   getStrategy(config2) {
  685 |     if (config2.customStrategy) return config2.customStrategy;
  686 |     switch (config2.authType) {
  687 |       case "email-password":
  688 |         return new EmailPasswordStrategy();
  689 |       case "email-password-otp":
  690 |         return new EmailPasswordOTPStrategy();
  691 |       case "email-otp":
  692 |         return new EmailOTPStrategy();
  693 |       case "oauth":
  694 |         return new OAuthStrategy();
  695 |       case "oidc":
  696 |         return new OIDCStrategy();
  697 |       case "saml":
  698 |         return new SAMLStrategy();
  699 |       default:
```