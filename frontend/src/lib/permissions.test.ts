import { describe, expect, it } from "vitest";
import { can, canManageSection, navFor } from "./permissions";

const STAFF = { id: "user-003", subsystemRole: "STAFF" as const };
const OTHER_STAFF = { id: "user-009", subsystemRole: "STAFF" as const };
const ADMIN = { id: "user-001", subsystemRole: "ADMIN" as const };
const STUDENT = { id: "user-002", subsystemRole: "STUDENT" as const };

describe("UI permissions mirror backend/src/auth/permissions.ts", () => {
  it("lets students check in and read their own records only", () => {
    expect(can("STUDENT", "attendance:check-in")).toBe(true);
    expect(can("STUDENT", "attendance-record:read:own")).toBe(true);
    expect(can("STUDENT", "class-section:read")).toBe(false);
    expect(can("STUDENT", "class-section:create")).toBe(false);
  });

  it("gives staff their own sections but no :any permission and no check-in", () => {
    expect(can("STAFF", "class-section:create")).toBe(true);
    expect(can("STAFF", "class-section:update:own")).toBe(true);
    expect(can("STAFF", "class-section:update:any")).toBe(false);
    expect(can("STAFF", "attendance-session:manage:any")).toBe(false);
    expect(can("STAFF", "attendance:check-in")).toBe(false);
  });

  it("gives alumni nothing", () => {
    expect(can("ALUMNI", "class-section:read")).toBe(false);
    expect(can("ALUMNI", "attendance:check-in")).toBe(false);
  });
});

describe("canManageSection", () => {
  it("allows the owner and ADMIN, never other staff or students", () => {
    for (const action of ["update", "delete", "manage"] as const) {
      expect(canManageSection(STAFF, "user-003", action)).toBe(true);
      expect(canManageSection(OTHER_STAFF, "user-003", action)).toBe(false);
      expect(canManageSection(ADMIN, "user-003", action)).toBe(true);
      expect(canManageSection(STUDENT, "user-002", action)).toBe(false);
    }
  });
});

describe("navFor", () => {
  const hrefs = (role: Parameters<typeof navFor>[0]) => navFor(role).map((item) => item.href);

  it("shows each role only the menus it can use", () => {
    expect(hrefs("STUDENT")).toEqual(["/", "/check-in", "/attendance-records"]);
    expect(hrefs("STAFF")).toEqual(["/", "/class-sections"]);
    expect(hrefs("ADMIN")).toEqual(["/", "/check-in", "/attendance-records", "/class-sections"]);
    expect(hrefs("ALUMNI")).toEqual(["/"]);
  });
});
