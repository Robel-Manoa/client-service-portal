import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../../src/core/date.util";

// Every response formatter in the app calls formatDate(iso) with the
// default withTime=true — the withTime=false (date-only) branch is never
// reached through any actual route, but it's part of the function's public
// contract, so it's tested directly here rather than left unreachable.

test("formatDate defaults to DD-MM-YYYY HH:mm", () => {
  assert.equal(formatDate("2023-01-05T09:30:00.000Z"), "05-01-2023 09:30");
});

test("formatDate(iso, false) returns date only, no time", () => {
  assert.equal(formatDate("2023-01-05T09:30:00.000Z", false), "05-01-2023");
});

test("formatDate pads single-digit day/month/hour/minute", () => {
  assert.equal(formatDate("2023-03-02T04:05:00.000Z"), "02-03-2023 04:05");
});

test("formatDate reads UTC, not server-local time", () => {
  // 23:30 UTC on the 5th is still the 5th in UTC regardless of the host's
  // local timezone — this is the whole point of using getUTC* internally.
  assert.equal(formatDate("2023-01-05T23:30:00.000Z"), "05-01-2023 23:30");
});
