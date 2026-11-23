import { ErrorScreen } from "@/components/shared/ErrorScreen";

export default function NotFound() {
  return <ErrorScreen title="Off the map" text="There is nothing at this address. Scan a checkpoint QR or open your hunt." />;
}
