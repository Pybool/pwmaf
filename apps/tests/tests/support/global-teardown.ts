import { getOrCreateAuthManager } from "qa-pwmaf";

async function globalTeardown() {
  const authManagerr = getOrCreateAuthManager();
  await authManagerr.teardown();
}

export default globalTeardown;
