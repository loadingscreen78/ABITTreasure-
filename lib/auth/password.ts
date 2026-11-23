import bcrypt from "bcryptjs";

/**
 * bcrypt via bcryptjs (pure JS — runs on Workers). Default cost 5 keeps a login under the
 * Workers free-plan CPU budget; passwords are 7 random chars, logins are rate-limited and
 * hashes are unreadable without the secret key. Raise BCRYPT_COST to 10 on Workers Paid.
 */
export const hashPassword = (canonical: string, cost = 5) => bcrypt.hash(canonical, cost);
export const checkPassword = (canonical: string, hash: string) => bcrypt.compare(canonical, hash);
