// /**
//  * integrity.spec.ts — Session integrity: /api/me + role assertions (§11 + [TEST]8)
//  *
//  * Uses pre-built sessions from global-setup (test.use storageState).
//  * No re-authentication — pure session-validity coverage.
//  *
//  * Per user:
//  *   - GET /api/me → 200, correct email and role
//  *   - GET /api/config → 200 (public route)
//  *   - GET /dashboard.html → user-info element visible with correct data
//  *   - POST /auth/logout → clears session → /api/me returns 401
//  */

// import { test, expect } from "qa-pwmaf";
// import { authFile, IUser } from "qa-pwmaf";
// import rawApiUsers from "../data/users.api.integrity.json";

// const allApiUsers = rawApiUsers as IUser[];


// // ─────────────────────────────────────────────────────────────────────────────
// // API users — [TEST]8
// // ─────────────────────────────────────────────────────────────────────────────

// test.describe("[TEST]8 Session integrity — API users", () => {
//   for (const user of allApiUsers) {
//       test.describe(`[${user.authType}] ${user.username}`, () => {
//         test.use({ storageState: authFile(user.username) });

//         test("GET /api/me returns 200 with correct email and role", async ({
//           request,
//         }) => {
          
//           const res = await request.get(`${user.actionUrl}/api/me`);
//           console.log("user.username ========> ", user.actionUrl, user.username, res.status());
//           expect(res.status()).toBe(200);
//           const { user: me } = await res.json();
//           expect(me.email).toBe(user.username);
//           expect(me.role).toBe(user.role);
//         });

//         // test("GET /api/config is public — 200 with authType field", async ({
//         //   request,
//         // }) => {
//         //   const res = await request.get(`${user.actionUrl}/api/config`);
//         //   expect(res.status()).toBe(200);
//         //   expect(await res.json()).toHaveProperty("authType");
//         // });

//         // test("POST /auth/logout clears session → /api/me returns 401", async ({
//         //   request,
//         // }) => {
//         //   expect((await request.get(`${user.actionUrl}/api/me`)).status()).toBe(
//         //     200,
//         //   );
//         //   await request.post(`${user.actionUrl}/auth/logout`);
//         //   expect((await request.get(`${user.actionUrl}/api/me`)).status()).toBe(
//         //     401,
//         //   );
//         // });
//       });
    
//   }

//   test("all admin API users return role: admin from /api/me", async ({
//     getContext,
//   }) => {
//     const admins = allApiUsers.filter((u) => u.role === "admin");
//     await Promise.all(
//       admins.map(async (user) => {
//         const ctx = await getContext(user.username);
//         const res = await ctx.request.get(`${user.actionUrl}/api/me`);
//         expect(res.status()).toBe(200);
//         expect((await res.json()).user.role).toBe("admin");
//       }),
//     );
//   });

//   test("all regular API users return role: user from /api/me", async ({
//     getContext,
//   }) => {
//     const regulars = allApiUsers.filter((u) => u.role === "user");
//     await Promise.all(
//       regulars.map(async (user) => {
//         const ctx = await getContext(user.username);
//         const res = await ctx.request.get(`${user.actionUrl}/api/me`);
//         expect(res.status()).toBe(200);
//         expect((await res.json()).user.role).toBe("user");
//       }),
//     );
//   });
// });
