import TeamApp from "@/components/team/TeamApp";

// Static shell. /s/<token> is rewritten here (next.config.ts); the page reads the token
// client-side and POSTs it, so a GET (link preview / prefetch) never changes anything.
export default function ScanPage() {
  return <TeamApp mode="scan" />;
}
