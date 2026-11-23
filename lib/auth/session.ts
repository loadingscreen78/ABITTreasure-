import "server-only";
import { jwtVerify, SignJWT } from "jose";

/** Team session: our own signed httpOnly cookie (teams are NOT Supabase Auth users). */
export const TEAM_COOKIE = "abit_team";
export const SESSION_HOURS = 3;

export interface TeamSession {
  teamId: string;
  sv: number;
  /** Token of the QR this login was made from (used when loginEveryScan is on). */
  st?: string;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signTeamSession(s: TeamSession, secret: string): Promise<string> {
  return new SignJWT({ sv: s.sv, ...(s.st ? { st: s.st } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.teamId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key(secret));
}

export async function verifyTeamSession(token: string | undefined, secret: string): Promise<TeamSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    return { teamId: payload.sub, sv: payload.sv, st: typeof payload.st === "string" ? payload.st : undefined };
  } catch {
    return null;
  }
}

export function cookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_HOURS * 3600 };
}
