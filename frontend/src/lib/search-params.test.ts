import { describe, expect, it } from "vitest";
import { firstParam, pageParam } from "./search-params";

describe("search params", () => {
  it("reads ?page= as a positive integer, defaulting to 1", () => {
    expect(pageParam("3")).toBe(3);
    expect(pageParam(undefined)).toBe(1);
    expect(pageParam("0")).toBe(1);
    expect(pageParam("-2")).toBe(1);
    expect(pageParam("1.5")).toBe(1);
    expect(pageParam("abc")).toBe(1);
    expect(pageParam(["4", "5"])).toBe(4);
  });

  it("takes the first value of a repeated param", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("x")).toBe("x");
    expect(firstParam(undefined)).toBeUndefined();
  });
});
