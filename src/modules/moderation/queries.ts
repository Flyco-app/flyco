import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getVerifiedIdentity } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env/server';
import { reportIdSchema } from './validation';

export type StaffAccess = { is_staff: boolean; roles: string[]; aal2: boolean };

export async function requireStaffAccess(requireAal2 = true) {
  if (!getServerEnv().SUPABASE_URL) redirect('/en/login');
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/en/login');
  const result = await identity.client.rpc('get_my_staff_access');
  if (result.error) throw new Error('Unable to verify staff access.');
  const access = (result.data as StaffAccess[])[0];
  if (!access?.is_staff) notFound();
  return { ...identity, access, needsMfa: requireAal2 && !access.aal2 };
}

export async function loadModerationDashboard() {
  const context = await requireStaffAccess(false);
  if (!context.access.aal2) return { ...context, reports: [], assignments: [] };
  const reports = await context.client.rpc('get_moderation_report_queue', {
    input_limit: 50,
    input_before_created_at: null,
    input_before_id: null,
  });
  if (reports.error) throw new Error('Unable to load moderation queue.');
  let assignments: unknown[] = [];
  if (context.access.roles.includes('administrator')) {
    const result = await context.client.rpc('get_staff_assignments');
    if (result.error) throw new Error('Unable to load staff assignments.');
    assignments = result.data ?? [];
  }
  return { ...context, reports: reports.data ?? [], assignments };
}

export async function loadModerationReport(
  id: string,
  includeEvidence = false,
) {
  const reportId = reportIdSchema.safeParse(id);
  if (!reportId.success) notFound();
  const context = await requireStaffAccess();
  if (context.needsMfa) redirect('/admin');
  const [report, history, evidence] = await Promise.all([
    context.client.rpc('get_moderation_report', {
      input_report_id: reportId.data,
    }),
    context.client.rpc('get_moderation_case_history', {
      input_report_id: reportId.data,
    }),
    includeEvidence &&
    context.access.roles.some(
      (role) => role === 'moderator' || role === 'administrator',
    )
      ? context.client.rpc('get_moderation_evidence', {
          input_report_id: reportId.data,
          input_purpose_code: 'follow_up',
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (report.error || history.error || evidence.error)
    throw new Error('Unable to load moderation case.');
  const row = (report.data as unknown[])[0];
  if (!row) notFound();
  return {
    ...context,
    report: row as Record<string, unknown>,
    history: history.data ?? [],
    evidence: (evidence.data as Array<Record<string, unknown>>)[0] ?? null,
  };
}
