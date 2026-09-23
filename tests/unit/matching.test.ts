import { describe, expect, it } from 'vitest';
import {
  hasKnownMatchReasons,
  matchingAlgorithmVersion,
  matchingReasonCodes,
  matchOffset,
  matchPageSchema,
} from '@/modules/matching/model';
import { reasonLabel } from '@/modules/matching/copy';

describe('deterministic matching boundary', () => {
  it('pins the algorithm version and ordered reason vocabulary', () => {
    expect(matchingAlgorithmVersion).toBe('v1');
    expect(matchingReasonCodes).toEqual([
      'exact_route',
      'date_window_fit',
      'category_accepted',
      'capacity_sufficient',
    ]);
    expect(hasKnownMatchReasons([...matchingReasonCodes])).toBe(true);
    expect(hasKnownMatchReasons(['exact_route', 'private_account_state'])).toBe(
      false,
    );
  });

  it('validates bounded stable pagination', () => {
    expect(matchPageSchema.parse('1')).toBe(1);
    expect(matchPageSchema.parse('400')).toBe(400);
    expect(matchPageSchema.safeParse('0').success).toBe(false);
    expect(matchPageSchema.safeParse('401').success).toBe(false);
    expect(matchOffset(3, 12)).toBe(24);
  });

  it('localizes every public reason without exposing rejection diagnostics', () => {
    for (const locale of ['fr', 'en', 'ar'] as const) {
      for (const reason of matchingReasonCodes)
        expect(reasonLabel(locale, reason).length).toBeGreaterThan(2);
    }
  });
});
