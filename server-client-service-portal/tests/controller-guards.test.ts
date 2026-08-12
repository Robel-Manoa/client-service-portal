import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import app from "../src/app";
import {
  getAllRequests,
  createRequest,
  getRequestById,
  updateRequest,
  updateRequestStatus,
  assignEngineer,
  getComments,
  createComment,
} from "../src/delivery/request.controller";
import { requireRole } from "../src/delivery/middlewares/auth.middleware";

// Every request.controller.ts handler (and requireRole) starts with its
// own "if (!req.user) return 401" — defense-in-depth in case it's ever
// wired up without `authenticate` in front of it. In the real app that
// never happens: every route in app.ts puts `authenticate` first, which
// always sets req.user before any of these run, so no HTTP request can
// ever actually reach this branch. The only way to exercise it directly
// is to call the exported handler ourselves, bypassing Express routing.

/** Minimal fake Response that just records what was sent, nothing else. */
function fakeResponse() {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, calls };
}

const noUserReq = {} as Request;

test("getAllRequests: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await getAllRequests(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("createRequest: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await createRequest(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("getRequestById: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await getRequestById(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("updateRequest: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await updateRequest(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("updateRequestStatus: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await updateRequestStatus(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("assignEngineer: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await assignEngineer(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("getComments: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await getComments(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("createComment: 401 when req.user is missing", async () => {
  const { res, calls } = fakeResponse();
  await createComment(noUserReq, res);
  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
});

test("requireRole: 401 when req.user is missing, and next() is never called", () => {
  const { res, calls } = fakeResponse();
  let nextCalled = false;

  requireRole("admin")(noUserReq, res, () => {
    nextCalled = true;
  });

  assert.deepEqual(calls, { status: 401, body: { error: "Not authenticated" } });
  assert.equal(nextCalled, false);
});

// --- authenticate: a header that isn't Bearer-prefixed at all ---
//
// The existing "missing token" test never sends an Authorization header,
// so it only exercises the left side of `!authHeader?.startsWith("Bearer")`
// (optional-chaining short-circuit on undefined). This exercises the right
// side: a header that's present but doesn't start with "Bearer" at all.

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("a non-Bearer Authorization header is rejected the same as a missing one (401)", async () => {
  const res = await fetch(`${baseUrl}/api/requests`, {
    headers: { Authorization: "Basic dXNlcjpwYXNz" },
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "Access denied. Missing token");
});
