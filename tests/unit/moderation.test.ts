import { describe, expect, it } from 'vitest';
import {
  decisionSchema,
  evidencePurposeSchema,
  noteSchema,
  staffGrantSchema,
} from '@/modules/moderation/validation';

const reportId = '10000000-0000-4000-8000-000000000001';

describe('moderation boundary validation', () => {
  it('accepts bounded plain-text notes and approved evidence purposes', () => {
    expect(
      noteSchema.parse({ reportId, body: ' Review completed. ' }).body,
    ).toBe('Review completed.');
    expect(evidencePurposeSchema.parse('initial_review')).toBe(
      'initial_review',
    );
    expect(evidencePurposeSchema.safeParse('curiosity').success).toBe(false);
  });

  it('binds account state to the selected decision', () => {
    const base = {
      reportId,
      reason: 'safety_risk',
      rationale: 'Documented safety concern.',
      confirmed: 'yes',
    };
    expect(
      decisionSchema.safeParse({
        ...base,
        decision: 'account_suspended',
        targetState: 'suspended',
      }).success,
    ).toBe(true);
    expect(
      decisionSchema.safeParse({
        ...base,
        decision: 'account_suspended',
        targetState: 'active',
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        ...base,
        decision: 'no_action',
        targetState: 'restricted',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown roles and unbounded role reasons', () => {
    expect(
      staffGrantSchema.safeParse({
        userId: reportId,
        role: 'finance_operator',
        reason: 'requested',
      }).success,
    ).toBe(false);
    expect(
      staffGrantSchema.safeParse({
        userId: reportId,
        role: 'moderator',
        reason: 'x',
      }).success,
    ).toBe(false);
  });
});
