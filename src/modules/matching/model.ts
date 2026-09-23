import { z } from 'zod';

export const matchingAlgorithmVersion = 'v1' as const;
export const matchingReasonCodes = [
  'exact_route',
  'date_window_fit',
  'category_accepted',
  'capacity_sufficient',
] as const;

export type MatchingReasonCode = (typeof matchingReasonCodes)[number];

export const matchPageSchema = z.coerce.number().int().min(1).max(400);

export function matchOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function hasKnownMatchReasons(
  values: string[],
): values is MatchingReasonCode[] {
  return values.every((value) =>
    matchingReasonCodes.includes(value as MatchingReasonCode),
  );
}
