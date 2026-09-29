/*
 * LOCAL STAND-IN for the `@csmju2030/design-system` package.
 *
 * tsconfig maps the package name to this folder, so application code already
 * imports from "@csmju2030/design-system". Once the private registry is
 * reachable: install the package, delete this folder, and remove the `paths`
 * entry in tsconfig.json.
 */
export * from "./components";
export * from "./format";
export * from "./icons";
export { CsmjuAppShell, type CsmjuUser } from "./app-shell";
export { ConfirmDialog } from "./confirm-dialog";
export type { NavItem } from "./nav";
