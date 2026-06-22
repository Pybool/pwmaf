import { authEvents } from "./AuthEvents";

export class AuthReporter {
  private logs: string[] = [];

  attach(): void {
    authEvents.on("session:saved", ({ filePath, enriched, userId }) => {
      const entry = JSON.stringify({
        event: "session:saved",
        filePath,
        userId,
        savedAt: enriched.metadata?.savedAt,
        origins: enriched.origins?.length ?? 0,
        cookies: enriched.cookies?.length ?? 0,
      });
      this.logs.push(entry);
      process.stdout.write(`[smart-auth] ${entry}\n`);
    });

    authEvents.on("session:failed", ({ filePath, error }) => {
      const entry = JSON.stringify({
        event: "session:failed",
        filePath,
        error: error.message,
      });
      this.logs.push(entry);
      process.stderr.write(`[smart-auth:ERROR] ${entry}\n`);
    });

    authEvents.on("session:deleted", ({ filePath }) => {
      this.logs.push(filePath);
      process.stdout.write(`[smart-auth:INFO] ${filePath}\n`);
    });
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}
