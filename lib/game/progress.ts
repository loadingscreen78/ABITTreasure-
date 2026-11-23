/**
 * Progress state machine (Section 2). Pure; mirrors the server-side SQL in arrive()/record_attempt().
 */

export type ScanDecision = "ARRIVE" | "REPEAT" | "ALREADY_CLEARED" | "WRONG_TURN" | "FINISHED";

export interface ProgressState {
  unlockedCp: number;
  arrived: boolean;
  qIndex: number;
  status: "ACTIVE" | "FINISHED" | "DISQUALIFIED";
}

export function decideScan(state: ProgressState, cpOrder: number): ScanDecision {
  if (state.status === "FINISHED") return "FINISHED";
  if (cpOrder < state.unlockedCp) return "ALREADY_CLEARED";
  if (cpOrder > state.unlockedCp) return "WRONG_TURN";
  return state.arrived ? "REPEAT" : "ARRIVE";
}

/** State after a correct answer at the current checkpoint with `questionCount` questions. */
export function afterCorrect(state: ProgressState, questionCount: number, isFinal: boolean): ProgressState {
  if (isFinal) return { ...state, status: "FINISHED" };
  if (state.qIndex + 1 < questionCount) return { ...state, qIndex: state.qIndex + 1 };
  return { ...state, unlockedCp: state.unlockedCp + 1, arrived: false, qIndex: 0 };
}

export function afterArrive(state: ProgressState): ProgressState {
  return { ...state, arrived: true, qIndex: 0 };
}

/** Number of punched slots on the 8-slot card. */
export function clearedCount(state: ProgressState, totalCheckpoints = 8): number {
  if (state.status === "FINISHED") return totalCheckpoints;
  return Math.max(0, Math.min(totalCheckpoints, state.unlockedCp - 1));
}
