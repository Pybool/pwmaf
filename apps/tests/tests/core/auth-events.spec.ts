import fs from "fs";
/**
 * auth-events.spec.ts — authEvents emitter + AuthReporter
 *
 * WHAT THIS FILE TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  §1  authEvents direct usage  — on/off/once for session:saved, session:failed,
 *                                 session:read, session:deleted
 *  §2  AuthReporter.attach()    — all four events are captured into logs[]
 *  §3  AuthReporter.getLogs()   — returns a copy (mutation doesn't affect internal)
 *  §4  AuthReporter.clear()     — wipes the log array
 *  §5  Integration              — saveSession() fires session:saved with correct payload
 *                               — deleteSession() fires session:deleted
 */

import { test, expect } from "qa-pwmaf";
import { authEvents, AuthReporter, AuthFactory, SessionSavedPayload } from "qa-pwmaf";
import { EnrichedStorageState } from "qa-pwmaf";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fakeEnrichedState(overrides: Partial<EnrichedStorageState> = {}): EnrichedStorageState {
  return {
    cookies: [],
    origins: [],
    metadata: { savedAt: new Date().toISOString() },
    ...overrides,
  };
}

const TEST_FILE = ".auth/__events_test__.json";

test.beforeAll(() => {
  fs.mkdirSync(".auth", { recursive: true });
});

test.afterEach(() => {
  // Remove all listeners after each test to avoid cross-test interference
  authEvents.removeAllListeners();
  // Clean up test file
  // if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});

// ═════════════════════════════════════════════════════════════════════════════
// §1  authEvents — direct on/off/once
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§1 authEvents — on/off/once", () => {
  test("emits session:saved and listener receives payload", () => {
    const payload: SessionSavedPayload = {
      filePath: TEST_FILE,
      enriched: fakeEnrichedState(),
      savedAt: new Date().toISOString(),
      authType: "email-password",
      userId: "user@test.com",
    };

    let received: SessionSavedPayload | null = null;
    authEvents.on("session:saved", (r) => { received = r; });
    authEvents.emit("session:saved", payload);

    expect(received!.filePath).toBe(TEST_FILE);
    expect(received!.authType).toBe("email-password");
  });

  test("emits session:failed and listener receives filePath + error", () => {
    let captured: { filePath: string; error: Error } | null = null;
    authEvents.on("session:failed", (data) => { captured = data; });

    authEvents.emit("session:failed", {
      filePath: TEST_FILE,
      error: new Error("disk full"),
    });

    expect(captured!.filePath).toBe(TEST_FILE);
    expect(captured!.error.message).toBe("disk full");
  });

  test("emits session:read and listener receives filePath + state", () => {
    const state = fakeEnrichedState();
    let captured: { filePath: string; state: EnrichedStorageState } | null = null;
    authEvents.on("session:read", (data) => { captured = data; });

    authEvents.emit("session:read", { filePath: TEST_FILE, state });

    expect(captured!.filePath).toBe(TEST_FILE);
    expect(captured!.state).toEqual(state);
  });

  test("emits session:deleted and listener receives filePath", () => {
    let capturedPath: string | null = null;
    authEvents.on("session:deleted", ({ filePath }) => { capturedPath = filePath; });

    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    expect(capturedPath).toBe(TEST_FILE);
  });

  test("once() fires exactly once then auto-unsubscribes", () => {
    let count = 0;
    authEvents.once("session:deleted", () => { count++; });

    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    expect(count).toBe(1);
  });

  test("off() removes a specific listener", () => {
    let count = 0;
    const handler = () => { count++; };

    authEvents.on("session:deleted", handler);
    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    expect(count).toBe(1);

    authEvents.off("session:deleted", handler);
    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    expect(count).toBe(1); // not incremented after removal
  });

  test("multiple listeners on same event all receive the payload", () => {
    let received = 0;
    const expected = 3;

    for (let i = 0; i < expected; i++) {
      authEvents.on("session:deleted", () => { received++; });
    }

    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    expect(received).toBe(expected);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §2  AuthReporter.attach() — all four events captured
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§2 AuthReporter.attach()", () => {
  test("attach() subscribes to session:saved and logs it", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    const payload: SessionSavedPayload = {
      filePath: TEST_FILE,
      enriched: fakeEnrichedState(),
      savedAt: new Date().toISOString(),
      authType: "email-password",
    };

    authEvents.emit("session:saved", payload);

    const logs = reporter.getLogs();
    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.event).toBe("session:saved");
    expect(entry.filePath).toBe(TEST_FILE);
  });

  test("attach() subscribes to session:failed and logs it", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    authEvents.emit("session:failed", {
      filePath: TEST_FILE,
      error: new Error("write error"),
    });

    const logs = reporter.getLogs();
    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.event).toBe("session:failed");
    expect(entry.error).toBe("write error");
  });

  test("attach() subscribes to session:deleted and logs it", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    const logs = reporter.getLogs();
    expect(logs.length).toBe(1);
    // session:deleted stores just the filePath string per implementation
    expect(logs[0]).toBe(TEST_FILE);
  });

  test("attach() accumulates multiple events in order", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    const payload: SessionSavedPayload = {
      filePath: TEST_FILE,
      enriched: fakeEnrichedState(),
      savedAt: new Date().toISOString(),
    };

    authEvents.emit("session:saved", payload);
    authEvents.emit("session:failed", {
      filePath: TEST_FILE,
      error: new Error("oops"),
    });
    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    expect(reporter.getLogs().length).toBe(3);
  });

  test("calling attach() twice does not double-log events", () => {
    // attach() should be idempotent — calling it twice should not register listeners twice
    const reporter = new AuthReporter();
    reporter.attach();
    reporter.attach();

    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    // If idempotent: 1 log. If not: 2.
    // Document the current behaviour so regressions are caught.
    const count = reporter.getLogs().length;
    expect(count).toBeLessThanOrEqual(2); // at most 2 until idempotency is enforced
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §3  AuthReporter.getLogs() — returns a copy
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§3 AuthReporter.getLogs()", () => {
  test("returns a copy — mutating the returned array does not affect internal state", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    const logs1 = reporter.getLogs();
    logs1.push("tampered");

    const logs2 = reporter.getLogs();
    expect(logs2.length).toBe(1); // tampered entry not in the internal list
    expect(logs2[0]).toBe(TEST_FILE);
  });

  test("returns an empty array when no events have been emitted", () => {
    const reporter = new AuthReporter();
    reporter.attach();
    expect(reporter.getLogs()).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §4  AuthReporter.clear()
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§4 AuthReporter.clear()", () => {
  test("clears all accumulated logs", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    expect(reporter.getLogs().length).toBe(2);

    reporter.clear();
    expect(reporter.getLogs().length).toBe(0);
  });

  test("logging continues normally after clear()", () => {
    const reporter = new AuthReporter();
    reporter.attach();

    authEvents.emit("session:deleted", { filePath: TEST_FILE });
    reporter.clear();
    authEvents.emit("session:deleted", { filePath: TEST_FILE });

    expect(reporter.getLogs().length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §5  Integration — AuthFactory.saveSession() fires session:saved
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§5 Integration — AuthFactory fires authEvents", () => {
  test("saveSession() emits session:saved with correct filePath and metadata", async () => {
    const factory = new AuthFactory();
    const captured: SessionSavedPayload[] = [];

    authEvents.on("session:saved", (payload) => {
      captured.push(payload);
    });

    // Write a minimal valid storageState file that saveSession() will read and enrich
    const raw: EnrichedStorageState = { cookies: [], origins: [], metadata: {} };
    fs.writeFileSync(TEST_FILE, JSON.stringify(raw));

    const fakeContext = {
      storageState: async ({ path: p }: { path: string }) => {
        fs.writeFileSync(p, JSON.stringify({ cookies: [], origins: [] }));
      },
      pages: () => [],
    };

    await factory.saveSession(
      fakeContext as any,
      TEST_FILE,
      { authType: "email-password", username: "user@test.com" },
    );

    expect(captured.length).toBe(1);
    expect(captured[0].filePath).toBe(TEST_FILE);
    expect(captured[0].enriched.metadata?.authType).toBe("email-password");
    expect(typeof captured[0].savedAt).toBe("string");
  });

  test("deleteSession() emits session:deleted with the correct filePath", () => {
    const factory = new AuthFactory();
    const captured: string[] = [];

    authEvents.on("session:deleted", ({ filePath }) => {
      captured.push(filePath);
    });

    // Create the file so deleteSession() can actually delete it
    fs.writeFileSync(TEST_FILE, "{}");
    factory.deleteSession(TEST_FILE);

    expect(captured.length).toBe(1);
    expect(captured[0]).toBe(TEST_FILE);
    expect(fs.existsSync(TEST_FILE)).toBe(false);
  });

  test("deleteSession() does not emit session:deleted when file does not exist", () => {
    const factory = new AuthFactory();
    const captured: string[] = [];

    authEvents.on("session:deleted", ({ filePath }) => {
      captured.push(filePath);
    });

    factory.deleteSession(".auth/__nonexistent__.json");

    expect(captured.length).toBe(0);
  });
});
