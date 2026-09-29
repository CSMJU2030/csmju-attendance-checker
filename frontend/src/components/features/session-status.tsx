import { Badge } from "@csmju2030/design-system";
import type { AttendanceSessionStatus } from "@/lib/types";

export function SessionStatusBadge({ status }: { status: AttendanceSessionStatus }) {
  return status === "OPEN" ? <Badge tone="success">เปิดอยู่</Badge> : <Badge tone="neutral">ปิดแล้ว</Badge>;
}
