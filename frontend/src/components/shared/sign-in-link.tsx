"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/shared/kit";
import { signInHref } from "@/lib/config";

type Props = { className?: string; children: React.ReactNode };

function HereLink({ className, children }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <ButtonLink href={signInHref(search ? `${pathname}?${search}` : pathname)} size="lg" className={className}>
      {children}
    </ButtonLink>
  );
}

/**
 * Sign-in button that brings the user back to the page they opened - e.g. a
 * student who scanned the classroom QR lands on /check-in?code=... again.
 */
export function SignInLink(props: Props) {
  return (
    <Suspense
      fallback={
        <ButtonLink href={signInHref()} size="lg" className={props.className}>
          {props.children}
        </ButtonLink>
      }
    >
      <HereLink {...props} />
    </Suspense>
  );
}
