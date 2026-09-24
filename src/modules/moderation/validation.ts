import { z } from 'zod';

export const reportIdSchema = z.uuid();
export const evidencePurposeSchema = z.enum([
  'initial_review',
  'follow_up',
  'decision_review',
  'safety_escalation',
]);
export const noteSchema = z.object({
  reportId: reportIdSchema,
  body: z.string().trim().min(3).max(2000),
});
export const decisionSchema = z
  .object({
    reportId: reportIdSchema,
    decision: z.enum([
      'no_action',
      'warning_recorded',
      'account_restricted',
      'account_suspended',
      'account_restored',
      'report_dismissed',
      'escalation_required',
    ]),
    reason: z.enum([
      'policy_violation',
      'safety_risk',
      'harassment',
      'fraud_risk',
      'prohibited_item',
      'insufficient_evidence',
      'duplicate_report',
      'resolved_by_support',
      'other',
    ]),
    rationale: z.string().trim().min(10).max(1000),
    targetState: z.enum(['active', 'restricted', 'suspended']).nullable(),
    confirmed: z.literal('yes'),
  })
  .superRefine((value, context) => {
    const expected =
      value.decision === 'account_restricted'
        ? 'restricted'
        : value.decision === 'account_suspended'
          ? 'suspended'
          : value.decision === 'account_restored'
            ? 'active'
            : null;
    if (value.targetState !== expected)
      context.addIssue({
        code: 'custom',
        path: ['targetState'],
        message: 'Invalid account action.',
      });
  });
export const staffGrantSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['support', 'moderator', 'administrator']),
  reason: z.string().trim().min(3).max(500),
});
export const staffRevokeSchema = z.object({
  assignmentId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  confirmed: z.literal('yes'),
});
