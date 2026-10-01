import { ButtonLink, EmptyState, SearchIcon } from "@/components/shared/kit";
import { STANDARD_MESSAGE } from "@/lib/errors";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchIcon}
      title="ไม่พบหน้านี้"
      description={STANDARD_MESSAGE.NOT_FOUND}
      action={
        <ButtonLink href="/" variant="secondary">
          กลับภาพรวม
        </ButtonLink>
      }
    />
  );
}
