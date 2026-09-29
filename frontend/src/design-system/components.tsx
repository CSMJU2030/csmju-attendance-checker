import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentPropsWithRef,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  InfoIcon,
} from "./icons";

/*
 * LOCAL STAND-IN for components of `@csmju2030/design-system` (section 7).
 * Names and props follow the package so that switching to the real package is
 * an import-path change only. Keep them free of domain logic.
 */

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-inverse hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-primary-soft text-primary hover:bg-primary-soft-hover active:bg-primary-soft-hover",
  ghost: "bg-transparent text-body hover:bg-surface-muted active:bg-primary-soft",
  danger: "bg-danger text-inverse hover:opacity-90 active:opacity-80",
  link: "bg-transparent text-primary underline-offset-4 hover:underline px-0",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-10 px-4 text-base",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-sm font-semibold",
    "transition-colors duration-fast ease-standard",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    variant === "link" ? "" : SIZE[size],
    className,
  );
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
      <span id={reasonId} className="text-sm text-body">
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

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        {back ? (
          <Link href={back.href} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ChevronLeftIcon size={16} />
            {back.label}
          </Link>
        ) : null}
        <h1 className="font-heading text-2xl font-semibold text-ink md:text-3xl">{title}</h1>
        {description ? <p className="text-body">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
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
  return (
    <Tag
      className={cx("overflow-hidden rounded-lg border border-line bg-surface", !flush && "p-4 md:p-6", className)}
      {...props}
    />
  );
}

export function CardTitle({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return <Tag className="font-heading text-lg font-semibold text-ink md:text-xl">{children}</Tag>;
}

/* -------------------------------------------------------------- StatCard */

const STAT_ICON_TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary",
  neutral: "bg-surface-muted text-body",
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
    <div className="flex items-start gap-4 rounded-lg border border-line bg-surface p-4 md:p-6">
      {icon ? (
        <span aria-hidden className={cx("flex size-11 shrink-0 items-center justify-center rounded-md", STAT_ICON_TONE[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-body">{label}</p>
        <p className="font-heading text-2xl font-semibold text-ink tabular-nums md:text-3xl">
          {value}
          {unit ? <span className="ml-1 text-base font-normal text-body">{unit}</span> : null}
        </p>
        {hint ? <p className="text-sm text-body">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  info: "bg-info-soft text-info border-info-line",
  neutral: "bg-surface-muted text-body border-line",
};

/** Status is always spelled out in text, never color alone (section 12.1.9). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-sm border px-2 text-sm font-semibold", BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

const ALERT_ICON = {
  success: CheckCircleIcon,
  warning: AlertTriangleIcon,
  danger: AlertCircleIcon,
  info: InfoIcon,
  neutral: InfoIcon,
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-md border p-4", BADGE_TONE[tone])}
    >
      <Icon className="mt-1 shrink-0" />
      <div className="flex flex-1 flex-col gap-1 text-body">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
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
      <span className="text-muted">
        <Icon size={48} />
      </span>
      <p className="font-heading text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-prose text-body">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
  reference,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  reference?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="text-danger">
        <AlertCircleIcon size={48} />
      </span>
      <p className="font-heading text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-prose text-body">{description}</p> : null}
      {reference ? <p className="font-mono text-sm text-body">รหัสอ้างอิง: {reference}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block animate-pulse rounded-sm bg-line", className)} />;
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
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-sm text-danger">
          <AlertCircleIcon size={16} className="mt-1 shrink-0" />
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

const INPUT =
  "min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-base text-ink " +
  "hover:border-line-strong aria-[invalid=true]:border-danger disabled:bg-surface-muted";

export function TextInput({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cx(INPUT, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select className={cx(INPUT, className)} {...props} />;
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-body">
      <input type="checkbox" className="size-5 accent-primary" {...props} />
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
          <dt className="text-sm text-muted">{item.term}</dt>
          <dd className="text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }
  const link = "inline-flex min-h-11 items-center gap-1 rounded-sm px-3 font-semibold text-primary hover:bg-primary-soft";
  return (
    <nav aria-label="เลขหน้า" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted tabular-nums">
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

/** Standard Thai names of core roles (section 10.3) - never translate locally. */
export const CORE_ROLE_LABEL: Record<string, string> = {
  student: "นักศึกษา",
  alumni: "ศิษย์เก่า",
  staff: "บุคลากร/อาจารย์",
  admin: "ผู้ดูแลระบบ",
};

export function RoleBadge({ coreRole }: { coreRole: string }) {
  return <Badge tone="info">{CORE_ROLE_LABEL[coreRole] ?? coreRole}</Badge>;
}
