type Param = string | string[] | undefined;

export function firstParam(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?page=` as a positive integer, defaulting to 1. */
export function pageParam(value: Param): number {
  const page = Number(firstParam(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
