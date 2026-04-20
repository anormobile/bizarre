import { createHmac, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import sql from "@/lib/db";
import type { SessionRow } from "@/lib/types";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Generate a random session id (32 bytes, hex-encoded). */
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a session id for storage in `sessions.token_hash`. */
export function hashSessionId(sessionId: string): string {
  return sha256(sessionId);
}

/**
 * Build the signed cookie value.
 * Format: base64(sessionId) + "." + HMAC_SHA256(sessionId, SESSION_SECRET)
 */
export function signSessionId(sessionId: string): string {
  const encoded = Buffer.from(sessionId).toString("base64");
  const signature = hmacSha256(sessionId, env.SESSION_SECRET);
  return `${encoded}.${signature}`;
}

/**
 * Parse and verify a signed cookie value.
 * Returns the raw session id if the signature is valid, or null otherwise.
 */
export function verifySessionCookie(cookieValue: string): string | null {
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);

  let sessionId: string;
  try {
    sessionId = Buffer.from(encoded, "base64").toString();
  } catch {
    return null;
  }

  const expected = hmacSha256(sessionId, env.SESSION_SECRET);

  if (signature.length !== expected.length) return null;

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return null;

  let mismatch = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    mismatch |= sigBuf[i]! ^ expBuf[i]!;
  }

  return mismatch === 0 ? sessionId : null;
}

/** Set the session cookie on the current response. */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, signSessionId(sessionId), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

/**
 * Read the session cookie, verify its signature, and return the raw
 * session id. Returns null if the cookie is missing or tampered.
 */
export async function readSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(env.SESSION_COOKIE_NAME);
  if (!cookie) return null;
  return verifySessionCookie(cookie.value);
}

/**
 * Read and verify the session cookie, then look up the session row.
 * Returns the session row if valid, or null otherwise.
 * Callers pass their own query function to avoid coupling to a specific
 * sql import (useful for testing and for the _session-check route).
 */
export async function getSession(
  query: (tokenHash: string) => Promise<SessionRow | undefined>,
): Promise<SessionRow | null> {
  const sessionId = await readSessionId();
  if (!sessionId) return null;

  const tokenHash = hashSessionId(sessionId);
  const row = await query(tokenHash);
  return row ?? null;
}

/**
 * Insert a session row, set the signed cookie, and return the raw session id.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = generateSessionId();
  const tokenHash = hashSessionId(sessionId);
  await sql`
    INSERT INTO sessions (user_id, token_hash)
    VALUES (${userId}, ${tokenHash})
  `;
  await setSessionCookie(sessionId);
  return sessionId;
}

/**
 * Delete the session row by token hash and clear the cookie.
 */
export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
  await clearSessionCookie();
}
