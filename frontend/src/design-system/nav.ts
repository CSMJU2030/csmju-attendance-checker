import { BookOpenIcon, HistoryIcon, LayoutDashboardIcon, MapPinIcon } from "./icons";

/** Icons are named like the package's Lucide names, so `nav` props stay portable. */
export const NAV_ICONS = {
  "layout-dashboard": LayoutDashboardIcon,
  "map-pin": MapPinIcon,
  history: HistoryIcon,
  "book-open": BookOpenIcon,
} as const;

export interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof NAV_ICONS;
  /** Other path prefixes that belong to this menu item (e.g. child screens). */
  match?: string[];
}
