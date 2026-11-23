"use client";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

export default function SegmentError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorScreen reset={reset} />;
}
