import { describe, expect, it } from "vitest";
import { classifyCheckInFailure } from "./check-in";
import { STANDARD_MESSAGE } from "./errors";

describe("classifyCheckInFailure", () => {
  it("puts a wrong or expired code under the code field", () => {
    expect(
      classifyCheckInFailure(400, { code: "BAD_REQUEST", message: "รหัสเช็คชื่อไม่ถูกต้อง หรือรหัสถูกเปลี่ยนใหม่แล้ว" }),
    ).toEqual({ kind: "field", message: "รหัสเช็คชื่อไม่ถูกต้อง หรือรหัสถูกเปลี่ยนใหม่แล้ว" });
  });

  it("shows a poor GPS fix as a warning alert, not a field error", () => {
    const failure = classifyCheckInFailure(400, {
      code: "BAD_REQUEST",
      message: "ตำแหน่งจากอุปกรณ์ไม่แม่นยำพอ (คลาดเคลื่อน 250 เมตร) กรุณาเปิด GPS แล้วลองใหม่",
    });
    expect(failure).toMatchObject({ kind: "notice", tone: "warning" });
  });

  it("shows outside-radius, duplicate and lockout (409) as warning alerts with the backend text", () => {
    for (const message of [
      "คุณอยู่นอกพื้นที่เช็คชื่อ (ห่าง 1112 เมตร เกินรัศมี 50 เมตร)",
      "คุณเช็คชื่อในรอบนี้แล้ว",
      "กรอกรหัสผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่",
    ]) {
      expect(classifyCheckInFailure(409, { code: "CONFLICT", message })).toEqual({
        kind: "notice",
        tone: "warning",
        title: "เช็คชื่อไม่สำเร็จ",
        message,
      });
    }
  });

  it("keeps a malformed request (VALIDATION_ERROR) off the field and uses the standard text", () => {
    expect(classifyCheckInFailure(400, { code: "VALIDATION_ERROR", message: "Request validation failed" })).toEqual({
      kind: "notice",
      tone: "warning",
      title: "เช็คชื่อไม่สำเร็จ",
      message: STANDARD_MESSAGE.VALIDATION_ERROR,
    });
  });

  it("uses a danger alert for 403 and server/network errors", () => {
    expect(classifyCheckInFailure(403, { code: "FORBIDDEN", message: "x" })).toMatchObject({
      kind: "notice",
      tone: "danger",
      message: STANDARD_MESSAGE.FORBIDDEN,
    });
    expect(classifyCheckInFailure(0, { code: "NETWORK_ERROR", message: "network" })).toMatchObject({
      tone: "danger",
      message: STANDARD_MESSAGE.NETWORK_ERROR,
    });
  });

  it("shows nothing on 401 - SSO is restarting", () => {
    expect(classifyCheckInFailure(401, { code: "UNAUTHORIZED", message: "x" })).toEqual({ kind: "none" });
  });
});
