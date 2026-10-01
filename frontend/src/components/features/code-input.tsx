"use client";

import { useState, type ComponentPropsWithRef } from "react";

const LENGTH = 6;

/**
 * Six boxes for the attendance code. There is still exactly one real
 * `<input>` (stretched invisibly over the boxes), so labels, screen readers,
 * paste and iOS one-time-code autofill all behave like a normal text field.
 */
export function CodeInput({
  value,
  onChange,
  invalid,
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: LENGTH }, (_, index) => {
          const digit = value[index] ?? "";
          const current = focused && index === active;
          return (
            <span
              key={index}
              className={
                "flex h-14 items-center justify-center rounded-lg border bg-surface-container-lowest font-mono text-headline-md font-semibold text-on-surface tabular-nums transition-colors duration-150 sm:h-16 " +
                (invalid
                  ? "border-error"
                  : current
                    ? "border-primary-container ring-2 ring-accent/40"
                    : digit
                      ? "border-outline-variant"
                      : "border-outline-variant/40")
              }
            >
              {digit || (current ? <span className="h-7 w-px bg-primary-container" /> : "")}
            </span>
          );
        })}
      </div>
      <input
        {...props}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={LENGTH}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, LENGTH))}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        // Invisible but real: it receives focus, typing, paste and autofill.
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-body-md text-transparent caret-transparent opacity-0"
      />
    </div>
  );
}
