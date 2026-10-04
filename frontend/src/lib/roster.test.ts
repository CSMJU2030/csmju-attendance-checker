import { describe, expect, it } from "vitest";
import { chunk, extractStudentCodes, parseEntryYear } from "./roster";

describe("extractStudentCodes", () => {
  it("finds ids in pasted lines, commas and spaces, once each and in order", () => {
    expect(extractStudentCodes("6504101234\n6504101235, 6504101234  6504101236")).toEqual([
      "6504101234",
      "6504101235",
      "6504101236",
    ]);
  });

  it("reads a registrar CSV and skips row numbers, names and short numbers", () => {
    const csv = 'ลำดับ,รหัสนักศึกษา,ชื่อ-สกุล,กลุ่ม\r\n1,6504101234,"นาย ก ข",1\r\n2,6504101235,"นางสาว ค ง",02\r\n';
    expect(extractStudentCodes(csv)).toEqual(["6504101234", "6504101235"]);
  });

  it("does not cut a longer number into an id", () => {
    expect(extractStudentCodes("1234567890123456")).toEqual([]);
    expect(extractStudentCodes("")).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits into batches the backend accepts", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
  });
});

describe("parseEntryYear", () => {
  it("accepts a Buddhist-era year only", () => {
    expect(parseEntryYear(" 2566 ")).toBe(2566);
    expect(parseEntryYear("66")).toBeNull();
    expect(parseEntryYear("2023.5")).toBeNull();
  });
});
