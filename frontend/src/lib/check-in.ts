import { errorMessage } from "./errors";
import type { ApiError } from "./types";

export type CheckInFailure =
  | { kind: "field"; message: string }
  | { kind: "notice"; tone: "warning" | "danger"; title: string; message: string }
  | { kind: "none" };

/**
 * Where a failed check-in is shown (ui-design-system.md 8.4 / 9.3):
 * - a wrong or expired code is about the code field → message under the field;
 * - anything the student can fix by acting (poor GPS fix, outside the room,
 *   already checked in, locked out) → warning alert;
 * - everything else → danger alert with the standard text;
 * - 401 → nothing: the client is already restarting SSO.
 */
export function classifyCheckInFailure(status: number, error: ApiError): CheckInFailure {
  if (status === 401) {
    return { kind: "none" };
  }
  const message = errorMessage(error);
  if (status === 400 && error.code === "BAD_REQUEST" && message.includes("รหัส")) {
    return { kind: "field", message };
  }
  if (status === 400 || status === 409) {
    return { kind: "notice", tone: "warning", title: "เช็คชื่อไม่สำเร็จ", message };
  }
  return { kind: "notice", tone: "danger", title: "เช็คชื่อไม่สำเร็จ", message };
}
