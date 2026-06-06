import * as jose from "jose";
import { env } from "./env";

const JWT_ALG = "HS256";

export type SessionPayload = {
  type: "access" | "refresh";
  userId?: number;
  sessionVersion?: number;
  jti?: string;
};

export async function signAccessToken(
  userId: number,
  sessionVersion: number,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT({ type: "access", userId, sessionVersion } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("15 min")
    .sign(secret);
}

export async function signRefreshToken(
  userId: number,
  sessionVersion: number,
  jti: string,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT({ type: "refresh", userId, sessionVersion, jti } as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7 days")
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const data = payload as unknown as SessionPayload;
    if (data.type !== "access") return null;
    return data;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const data = payload as unknown as SessionPayload;
    if (data.type !== "refresh") return null;
    return data;
  } catch {
    return null;
  }
}
