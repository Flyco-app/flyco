import { describe, expect, it } from 'vitest';
import {
  policyCopy,
  policyVersions,
  prohibitedItemConcepts,
} from '@/modules/policy/config';

describe('marketplace policy configuration', () => {
  it('uses stable acknowledgement versions', () => {
    expect(policyVersions.senderDeclaration).toBe('sender-safety-2026-09-v1');
    expect(policyVersions.travelerSafety).toBe('traveler-safety-2026-09-v1');
  });

  it('has a localized label for every prohibited concept', () => {
    for (const locale of ['fr', 'en', 'ar'] as const)
      for (const concept of prohibitedItemConcepts)
        expect(policyCopy[locale][concept.code]).toBeTruthy();
  });

  it('marks legal documents as pre-launch drafts in every locale', () => {
    for (const locale of ['fr', 'en', 'ar'] as const)
      expect(policyCopy[locale].draft.length).toBeGreaterThan(20);
  });
});
