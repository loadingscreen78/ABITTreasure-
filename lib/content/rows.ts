import type { Hunt } from "./schema";

/** Convert hunt.json into DB rows (pure; used by the seed script and the SQL tests). */
export function huntToRows(hunt: Hunt, tokens: Record<string, string>) {
  const checkpoints = hunt.checkpoints.map((c) => ({
    code: c.code,
    ord: c.order,
    token: tokens[c.code]!,
    location: c.location,
    venue_detail: c.venueDetail,
    arrival_credit: c.arrivalCredit,
    arrival_note: c.arrivalNote,
    reveal: c.reveal,
  }));
  const questions = hunt.checkpoints.flatMap((c) =>
    c.questions.map((q, i) => ({
      id: q.id,
      checkpoint_code: c.code,
      position: i,
      clue: q.clue,
      title: q.title,
      prompt: q.prompt,
      code: q.code,
      match: q.match,
      accept: q.accept,
      near_miss: q.nearMiss,
      is_final: q.isFinal ?? false,
    })),
  );
  return { checkpoints, questions };
}
