import { describe, expect, it } from "vitest";
import { STANDARD_MESSAGE, errorMessage } from "./errors";

describe("errorMessage - ui-design-system.md 9.3", () => {
  it("passes through the backend's Thai BAD_REQUEST and CONFLICT messages", () => {
    expect(errorMessage({ code: "CONFLICT", message: "คุณเช็คชื่อในรอบนี้แล้ว" })).toBe("คุณเช็คชื่อในรอบนี้แล้ว");
    expect(errorMessage({ code: "BAD_REQUEST", message: "รหัสเช็คชื่อไม่ถูกต้อง" })).toBe("รหัสเช็คชื่อไม่ถูกต้อง");
  });

  it("never shows raw English framework messages", () => {
    expect(errorMessage({ code: "CONFLICT", message: "Unique constraint failed" })).toBe(STANDARD_MESSAGE.CONFLICT);
    expect(errorMessage({ code: "VALIDATION_ERROR", message: "Request validation failed" })).toBe(
      STANDARD_MESSAGE.VALIDATION_ERROR,
    );
    expect(errorMessage({ code: "BAD_REQUEST", message: "Bad Request" })).toBe(STANDARD_MESSAGE.VALIDATION_ERROR);
  });

  it("uses the standard text for FORBIDDEN even when the backend sends its own", () => {
    expect(errorMessage({ code: "FORBIDDEN", message: "คุณไม่ได้เป็นผู้สอนของกลุ่มเรียนนี้" })).toBe(
      STANDARD_MESSAGE.FORBIDDEN,
    );
  });

  it("maps NOT_FOUND, network failures and unknown errors to the standard texts", () => {
    expect(errorMessage({ code: "NOT_FOUND", message: "x" })).toBe(STANDARD_MESSAGE.NOT_FOUND);
    expect(errorMessage({ code: "NETWORK_ERROR", message: "network" })).toBe(STANDARD_MESSAGE.NETWORK_ERROR);
    expect(errorMessage({ code: "INTERNAL_ERROR", message: "Internal server error" })).toBe(
      STANDARD_MESSAGE.INTERNAL_ERROR,
    );
  });
});
