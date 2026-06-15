import { EventEmitter } from "events";
import { EnrichedStorageState } from "../types";

export type SessionSavedPayload = {
  filePath: string;
  enriched: EnrichedStorageState;
  userId?: string;
  authType?: string;
  savedAt: string;
};

export type AuthEventMap = {
  "session:saved": [SessionSavedPayload];
  "session:failed": [{ filePath: string; error: Error }];
  "session:read": [{ filePath: string; state: EnrichedStorageState }];
  "session:deleted": [{ filePath: string }];
};

class AuthEventEmitter extends EventEmitter {
  emit<K extends keyof AuthEventMap>(
    event: K,
    ...args: AuthEventMap[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof AuthEventMap>(
    event: K,
    listener: (...args: AuthEventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof AuthEventMap>(
    event: K,
    listener: (...args: AuthEventMap[K]) => void,
  ): this {
    return super.once(event, listener);
  }

  off<K extends keyof AuthEventMap>(
    event: K,
    listener: (...args: AuthEventMap[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

// Singlteon one emitter for the whole frameworrk lifecycle
export const authEvents = new AuthEventEmitter();
