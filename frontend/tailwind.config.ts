import type { Config } from "tailwindcss";

/**
 * Local stand-in for `@csmju2030/design-system/tailwind-preset`: every color,
 * radius, shadow, z-index and duration points at a `--csmju-*` token, so no
 * raw value ever appears in a class name. Spacing uses Tailwind's 4px scale,
 * which lines up with the 8pt token scale (p-2 = 8px, p-4 = 16px, p-6 = 24px).
 */
const token = (name: string) => `var(--csmju-${name})`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Type scale from ui-design-system.md 4.2. Tailwind's defaults use English
    // line-heights (text-sm is 1.43), which clip Thai tone marks.
    fontSize: {
      xs: ["12px", { lineHeight: "1.6" }],
      sm: ["14px", { lineHeight: "1.6" }],
      base: ["16px", { lineHeight: "1.65" }],
      lg: ["18px", { lineHeight: "1.6" }],
      xl: ["20px", { lineHeight: "1.5" }],
      "2xl": ["24px", { lineHeight: "1.45" }],
      "3xl": ["30px", { lineHeight: "1.4" }],
      "4xl": ["40px", { lineHeight: "1.35" }],
      code: ["56px", { lineHeight: "1.2" }],
      "code-lg": ["96px", { lineHeight: "1.1" }],
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: token("color-primary"),
          hover: token("color-primary-hover"),
          active: token("color-primary-active"),
          soft: token("color-primary-soft"),
          "soft-hover": token("color-primary-soft-hover"),
        },
        "focus-ring": token("color-focus-ring"),
        canvas: token("color-canvas"),
        surface: {
          DEFAULT: token("color-surface"),
          muted: token("color-surface-muted"),
          inverse: token("color-surface-inverse"),
        },
        ink: token("color-text"),
        body: token("color-text-body"),
        muted: token("color-text-muted"),
        inverse: token("color-text-inverse"),
        line: {
          DEFAULT: token("color-border"),
          strong: token("color-border-strong"),
        },
        success: {
          DEFAULT: token("color-success-text"),
          soft: token("color-success-soft"),
          line: token("color-success-line"),
        },
        warning: {
          DEFAULT: token("color-warning-text"),
          soft: token("color-warning-soft"),
          line: token("color-warning-line"),
        },
        danger: {
          DEFAULT: token("color-danger-text"),
          soft: token("color-danger-soft"),
          line: token("color-danger-line"),
        },
        info: {
          DEFAULT: token("color-info-text"),
          soft: token("color-info-soft"),
          line: token("color-info-line"),
        },
      },
      borderRadius: {
        sm: token("radius-sm"),
        md: token("radius-md"),
        lg: token("radius-lg"),
        xl: token("radius-xl"),
        full: token("radius-full"),
      },
      boxShadow: {
        none: token("shadow-none"),
        sm: token("shadow-sm"),
        md: token("shadow-md"),
        lg: token("shadow-lg"),
      },
      zIndex: {
        sticky: token("z-sticky"),
        header: token("z-header"),
        drawer: token("z-drawer"),
        modal: token("z-modal"),
        popover: token("z-popover"),
        toast: token("z-toast"),
      },
      transitionDuration: {
        fast: token("duration-fast"),
        base: token("duration-base"),
        slow: token("duration-slow"),
      },
      transitionTimingFunction: {
        standard: token("ease-standard"),
        out: token("ease-out"),
      },
      fontFamily: {
        heading: token("font-heading"),
        body: token("font-body"),
        mono: token("font-mono"),
      },
      maxWidth: {
        container: token("container-max"),
      },
      width: {
        sidebar: token("sidebar-width"),
      },
      height: {
        header: token("header-height"),
      },
      inset: {
        header: token("header-height"),
      },
    },
  },
  plugins: [],
};

export default config;
