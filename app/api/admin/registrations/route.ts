import { safe } from "@/lib/server/db";
import { fail, handler, json } from "@/lib/server/http";
import { organiserRequest } from "@/lib/server/organiser-route";
import { writeXlsx } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

interface Reg {
  id: number;
  team_name: string;
  members: string[];
  status: "PENDING" | "IMPORTED" | "REJECTED";
  team_id: string | null;
  ref: string;
  created_at: string;
}

/**
 * GET                  → JSON list for the admin Registrations panel
 * GET ?format=xlsx     → Excel file (name, member1..4 first — same columns as the bulk team import)
 *     &status=pending  → only registrations not yet turned into teams
 */
export const GET = handler("admin/registrations", async (req: Request) => {
  const r = await organiserRequest(["admin"]);
  if (!r.ok) return r.res;
  const url = new URL(req.url);
  const res = await safe(r.db.from("registrations").select("id, team_name, members, status, team_id, ref, created_at").order("created_at"), "registrations");
  if (res.error) return fail("NETWORK", "Database unreachable. Retrying…", 503);
  let rows = res.data as Reg[];
  if (url.searchParams.get("status") === "pending") rows = rows.filter((x) => x.status === "PENDING");

  if (url.searchParams.get("format") === "xlsx") {
    const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
    const sheet = [
      ["name", "member1", "member2", "member3", "member4", "registered_at", "reference", "status", "team_id"],
      ...rows.map((x) => [x.team_name, x.members[0] ?? "", x.members[1] ?? "", x.members[2] ?? "", x.members[3] ?? "", ist(x.created_at), x.ref, x.status, x.team_id ?? ""]),
    ];
    const bytes = writeXlsx(sheet, "Registrations");
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tech-treasure-hunt-registrations-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return json({
    ok: true,
    registrations: rows,
    counts: {
      pending: rows.filter((x) => x.status === "PENDING").length,
      imported: rows.filter((x) => x.status === "IMPORTED").length,
      rejected: rows.filter((x) => x.status === "REJECTED").length,
    },
  });
});
