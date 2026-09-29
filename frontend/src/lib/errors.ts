import type { ApiError } from "./types";

/**
 * error.code → user-facing Thai text (ui-design-system.md 9.3). Only
 * BAD_REQUEST and CONFLICT carry the backend's own message: this backend
 * writes those in Thai for the user. Everything else uses the standard text,
 * so raw English framework messages never reach the screen.
 */
export const STANDARD_MESSAGE = {
  FORBIDDEN: "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้",
  NOT_FOUND: "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง",
  CONFLICT: "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่",
  VALIDATION_ERROR: "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง",
  INTERNAL_ERROR: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง หากยังพบปัญหา กรุณาแจ้งผู้ดูแลระบบ",
  NETWORK_ERROR: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
} as const;

const THAI = /[฀-๿]/;

export function errorMessage(error: ApiError): string {
  if ((error.code === "BAD_REQUEST" || error.code === "CONFLICT") && THAI.test(error.message)) {
    return error.message;
  }
  switch (error.code) {
    case "FORBIDDEN":
      return STANDARD_MESSAGE.FORBIDDEN;
    case "NOT_FOUND":
      return STANDARD_MESSAGE.NOT_FOUND;
    case "CONFLICT":
      return STANDARD_MESSAGE.CONFLICT;
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return STANDARD_MESSAGE.VALIDATION_ERROR;
    case "NETWORK_ERROR":
      return STANDARD_MESSAGE.NETWORK_ERROR;
    default:
      return STANDARD_MESSAGE.INTERNAL_ERROR;
  }
}
