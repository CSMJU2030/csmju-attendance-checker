import { describe, expect, it } from "vitest";
import { csvFileParts, toCsv } from "./csv";

describe("csvFileParts", () => {
  it("always starts the file with the UTF-8 BOM bytes", () => {
    const [bom, body] = csvFileParts("รหัส\r\n");
    expect([...bom]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body).toBe("รหัส\r\n");
  });

  it("does not write the BOM twice when the content already has one", () => {
    const [, body] = csvFileParts(toCsv(["รหัส"], [["1"]]));
    expect(body.charCodeAt(0)).not.toBe(0xfeff);
    expect(body).toBe("รหัส\r\n1\r\n");
  });
});

describe("toCsv text columns", () => {
  it("keeps digit-only ids as text and leaves other values alone", () => {
    const csv = toCsv(["id", "note"], [["0650410123", "7"], ["=1+1", "x"]], [0]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('="0650410123",7');
    expect(lines[2]).toBe("'=1+1,x");
  });
});
