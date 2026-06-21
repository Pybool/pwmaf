export const logger = {
  ok: (msg: string) => console.log(`[OK] ${msg}`),
  skip: (msg: string) => console.log(`[SKIP] ${msg}`),
  warn: (msg: string) => console.log(`[WARN] ${msg}`),
  info: (msg: string) => console.log(`[INFO] ${msg}`),
};