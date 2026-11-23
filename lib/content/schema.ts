import { z } from "zod";

const MatchMode = z.enum(["exact", "acronym", "number", "html-tag", "no-such-number", "secret-word"]);

export const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d{2}$/),
  clue: z.number().int().min(1).max(15),
  title: z.string().min(1),
  prompt: z.string().min(1),
  code: z.string().nullable(),
  match: MatchMode,
  accept: z.array(z.string().min(1)).min(1),
  nearMiss: z.record(z.string(), z.string()),
  isFinal: z.boolean().optional(),
});

export const RevealSchema = z.object({
  clue: z.number().int().nullable(),
  title: z.string(),
  riddle: z.string().min(1),
  nudge: z.string().nullable(),
  leadsTo: z.string(),
});

export const CheckpointSchema = z.object({
  code: z.string().regex(/^CP-\d{2}$/),
  order: z.number().int().min(1),
  location: z.string(),
  venueDetail: z.string().nullable(),
  arrivalCredit: z.object({ clue: z.number().int(), title: z.string(), answer: z.string() }).nullable(),
  arrivalNote: z.string().nullable(),
  questions: z.array(QuestionSchema).min(1),
  reveal: RevealSchema.nullable(),
});

export const HuntSchema = z.object({
  event: z.object({
    institute: z.string(),
    instituteShort: z.string(),
    city: z.string(),
    address: z.string(),
    department: z.string(),
    series: z.string(),
    title: z.string(),
    tagline: z.string(),
    motto: z.string(),
    coordinates: z.string(),
    eligibility: z.string(),
    teamSize: z.string(),
    durationMinutes: z.number(),
  }),
  settings: z.object({
    secretWord: z.string().min(1),
    marksPerClue: z.number().int(),
    fullMarksWithinAttempts: z.number().int().min(1),
    cooldownSecondsAfterLimit: z.number().int().min(0),
    finalStageMarks: z.number().int(),
    teamworkMax: z.number().int(),
    timeBonus: z.array(z.number().int()),
    timeBonusMode: z.enum(["tiered", "tiebreak"]),
    hintPenalty: z.number().int().min(0),
    loginEveryScan: z.boolean(),
    showScoresOnBoard: z.boolean(),
  }).passthrough(),
  checkpoints: z.array(CheckpointSchema).length(8),
});

export type Hunt = z.infer<typeof HuntSchema>;
export type HuntCheckpoint = z.infer<typeof CheckpointSchema>;
export type HuntQuestion = z.infer<typeof QuestionSchema>;

/** Tie-breaker questions for the judge panel only (Section 5). Not team-facing. */
export const TIE_BREAKERS = [
  { q: "Which number comes next in the sequence 2, 4, 8, 16, __?", a: "32" },
  { q: "What does URL stand for?", a: "Uniform Resource Locator" },
  { q: "Which device is used to connect multiple computers in a local area network?", a: "Switch; accept hub where appropriate" },
];
