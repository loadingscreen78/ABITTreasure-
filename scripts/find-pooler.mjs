// Finds the Supabase connection-pooler host (IPv4) for this project by trying each region.
import pg from "pg";
const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) { console.error("Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD in .env.local"); process.exit(1); }
const regions = ["ap-south-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2","us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-central-2","eu-north-1","ca-central-1","sa-east-1"];
const hosts = regions.flatMap((r) => [`aws-0-${r}.pooler.supabase.com`, `aws-1-${r}.pooler.supabase.com`]);
const tryHost = async (host) => {
  const c = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
  try { await c.connect(); await c.query("select 1"); await c.end(); return { host, ok: true }; }
  catch (e) { try { await c.end(); } catch {} return { host, ok: false, msg: String(e.message).slice(0, 80) }; }
};
const results = await Promise.all(hosts.map(tryHost));
const hit = results.find((r) => r.ok);
if (hit) { console.log("POOLER_HOST=" + hit.host); process.exit(0); }
const auth = results.find((r) => /password/i.test(r.msg ?? ""));
if (auth) { console.log("Region found but password rejected:", auth.host, auth.msg); process.exit(2); }
console.log("No pooler host accepted the connection."); for (const r of results.slice(0, 4)) console.log(r.host, r.msg);
process.exit(1);
