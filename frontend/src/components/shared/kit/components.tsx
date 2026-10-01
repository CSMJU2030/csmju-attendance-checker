import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentPropsWithRef, HTMLAttributes, ReactNode } from "react";
import {
  PageHeader as CsmjuPageHeader,
  StatusBadge,
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type StatusTone,
} from "@/csmju";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon, InfoIcon } from "./icons";

/*
 * Local components (ui-design-system.md 17.0): the pieces of section 7.1 that
 * the central `csmju/` template does not ship yet, built only from the classes
 * in `csmju/ui.ts` and the `@theme` tokens of `app/globals.css`. Listed under
 * `local_components` in subsystem.yaml until the central package has them.
 */

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

// Central classes first; `ghost` and `link` are the only local additions.
const VARIANT: Record<ButtonVariant, string> = {
  primary: primaryButtonClass,
  secondary: cx(secondaryButtonClass, "flex items-center justify-center gap-2"),
  ghost:
    "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant/50",
  danger: cx(dangerButtonClass, "flex items-center justify-center gap-2"),
  link: "inline-flex items-center gap-1 text-label-md text-primary-container hover:underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9",
  md: "min-h-11",
  lg: "min-h-12 px-6",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cx(VARIANT[variant], variant === "link" ? "" : SIZE[size], "disabled:cursor-not-allowed disabled:opacity-50", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Required whenever `disabled` is set (section 10.2). */
  disabledReason?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  disabledReason,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const reasonId = disabled && disabledReason ? `${props.id ?? "btn"}-reason` : undefined;
  const button = (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-describedby={reasonId}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
  if (!reasonId) {
    return button;
  }
  return (
    <span className="inline-flex flex-col gap-1">
      {button}
      <span id={reasonId} className="text-label-sm text-on-surface-variant">
        {disabledReason}
      </span>
    </span>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Navigation that looks like a button - still an `<a>` (section 12.1). */
export function ButtonLink({ href, variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

/* ------------------------------------------------------------------ Layout */

/**
 * The central PageHeader (h1 + description) with what section 5.2 also asks
 * for: a back link above it and the page's actions on the right.
 */
export function PageHeaderBar({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-label-md text-primary-container hover:underline"
        >
          <ChevronLeftIcon size={16} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <CsmjuPageHeader title={title} description={description ?? ""} />
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  className,
  as: Tag = "section",
  flush = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article";
  /** No inner padding - for lists and tables that run edge to edge. */
  flush?: boolean;
}) {
  return <Tag className={cx(cardClass, !flush && "p-4 md:p-6", className)} {...props} />;
}

export function CardTitle({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return <Tag className="font-display text-[20px] font-semibold leading-[1.4] text-on-surface">{children}</Tag>;
}

/* -------------------------------------------------------------- Status */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TO_STATUS_TONE: Record<Tone, StatusTone> = {
  success: "success",
  warning: "warning",
  danger: "error",
  info: "info",
  neutral: "neutral",
};

/** Status label - the central StatusBadge (dot + text, never colour alone). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  return <StatusBadge tone={TO_STATUS_TONE[tone]} label={children} />;
}

/* -------------------------------------------------------------- StatCard */

const ICON_TONE: Record<Tone, string> = {
  success: "bg-success/10 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-error-container text-on-error-container",
  info: "bg-primary-container/10 text-primary-container",
  neutral: "bg-surface-variant text-on-surface-variant",
};

/** One headline number with its label (section 7.1 Data display). */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "info",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={cx(cardClass, "flex items-start gap-4 p-4 md:p-6")}>
      {icon ? (
        <span aria-hidden className={cx("flex size-11 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-label-md text-on-surface-variant">{label}</p>
        <p className="font-display text-[28px] font-bold leading-[1.2] text-primary-container tabular-nums">
          {value}
          {unit ? <span className="ml-1 font-body text-body-md font-normal text-on-surface-variant">{unit}</span> : null}
        </p>
        {hint ? <p className="text-label-sm font-normal text-secondary">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */

const ALERT_TONE: Record<Tone, string> = {
  success: "border-success/30 bg-success/10",
  warning: "border-amber-300 bg-amber-50",
  danger: "border-error/30 bg-error-container",
  info: "border-primary-container/20 bg-primary-container/5",
  neutral: "border-outline-variant/40 bg-surface-container-low",
};

const ALERT_ICON_TONE: Record<Tone, string> = {
  success: "text-emerald-700",
  warning: "text-amber-800",
  danger: "text-error",
  info: "text-primary-container",
  neutral: "text-on-surface-variant",
};

const ALERT_ICON = {
  success: CheckCircleIcon,
  warning: AlertTriangleIcon,
  danger: AlertCircleIcon,
  info: InfoIcon,
  neutral: InfoIcon,
} as const;

export function Alert({ tone = "info", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={cx("flex gap-3 rounded-lg border p-4", ALERT_TONE[tone])}>
      <Icon className={cx("mt-0.5 shrink-0", ALERT_ICON_TONE[tone])} />
      <div className="flex flex-1 flex-col gap-1 text-body-md text-on-surface-variant">
        {title ? <p className="font-semibold text-on-surface">{title}</p> : null}
        {children ? <div>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
}: {
  icon?: (props: { size?: 48; className?: string }) => ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
        <Icon size={48} className="size-8" />
      </span>
      <p className="font-display text-[18px] font-semibold leading-[1.4] text-on-surface">{title}</p>
      {description ? <p className="max-w-prose text-body-md text-on-surface-variant">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, action, reference }: { title: string; description?: string; action?: ReactNode; reference?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-error-container text-error">
        <AlertCircleIcon size={48} className="size-8" />
      </span>
      <p className="font-display text-[18px] font-semibold leading-[1.4] text-on-surface">{title}</p>
      {description ? <p className="max-w-prose text-body-md text-on-surface-variant">{description}</p> : null}
      {reference ? <p className="font-mono text-label-sm text-on-surface-variant">รหัสอ้างอิง: {reference}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block animate-pulse rounded-md bg-surface-container-high", className)} />;
}

/* -------------------------------------------------------------------- Form */

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label-md text-on-surface">
        {label}
        {required ? (
          <span className="text-error" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-label-sm font-normal leading-[1.6] text-on-surface-variant">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-label-sm font-normal leading-[1.6] text-error">
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Wires `aria-describedby` / `aria-invalid` to the ids FormField renders. */
export function fieldA11y(id: string, { error, hint, required }: { error?: string; hint?: string; required?: boolean }) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

/** The central `inputClass`, plus the central `input-error` state. */
export function TextInput({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cx(inputClass, "min-h-11", props["aria-invalid"] ? "input-error" : "", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select className={cx(inputClass, "min-h-11", props["aria-invalid"] ? "input-error" : "", className)} {...props} />;
}

/** Uses the central `custom-checkbox` style from globals.css. */
export function Checkbox({ label, ...props }: ComponentPropsWithRef<"input"> & { label: string }) {
  return (
    <label className="custom-checkbox inline-flex min-h-11 cursor-pointer items-center gap-2 text-body-md text-on-surface-variant">
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------ Data display */

export function DescriptionList({ items }: { items: Array<{ term: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term} className="flex flex-col gap-1">
          <dt className="text-label-sm font-normal text-on-surface-variant">{item.term}</dt>
          <dd className="text-body-md text-on-surface">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({ page, totalPages, total, hrefFor }: { page: number; totalPages: number; total: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) {
    return null;
  }
  const link =
    "inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-label-md text-primary-container transition-colors hover:bg-primary-container/5";
  return (
    <nav aria-label="เลขหน้า" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-label-sm font-normal text-on-surface-variant tabular-nums">
        หน้า {page} จาก {totalPages} · ทั้งหมด {total} รายการ
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={link}>
            <ChevronLeftIcon size={16} />
            ก่อนหน้า
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={link}>
            ถัดไป
            <ChevronRightIcon size={16} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------- Auth / roles */

/** Standard Thai names of core roles (section 10.3, vocabulary.json 1.1). */
export const CORE_ROLE_LABEL: Record<string, string> = {
  student: "นักศึกษา",
  alumni: "ศิษย์เก่า",
  staff: "บุคลากร",
  lecturer: "อาจารย์",
  guest: "ผู้เยี่ยมชม",
  admin: "ผู้ดูแลระบบ",
};

export function RoleBadge({ coreRole }: { coreRole: string }) {
  return <StatusBadge tone="info" label={CORE_ROLE_LABEL[coreRole] ?? coreRole} />;
}
