'use server';
import { redirect } from 'next/navigation';
import { assertTrustedServerActionOrigin } from '@/lib/auth/origin';
import { requireStaffAccess } from './queries';
import {
  decisionSchema,
  evidencePurposeSchema,
  noteSchema,
  reportIdSchema,
  staffGrantSchema,
  staffRevokeSchema,
} from './validation';

function back(reportId: string, result: string): never {
  redirect(`/admin/reports/${reportId}?result=${result}`);
}

export async function openReport(form: FormData) {
  await assertTrustedServerActionOrigin();
  const id = reportIdSchema.safeParse(form.get('reportId'));
  if (!id.success) redirect('/admin?error=invalid');
  const { client } = await requireStaffAccess();
  const result = await client.rpc('open_moderation_report', {
    input_report_id: id.data,
  });
  if (result.error) back(id.data, 'failed');
  back(id.data, 'opened');
}

export async function addNote(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = noteSchema.safeParse({
    reportId: form.get('reportId'),
    body: form.get('body'),
  });
  if (!parsed.success) redirect('/admin?error=invalid');
  const { client } = await requireStaffAccess();
  const result = await client.rpc('add_moderation_note', {
    input_report_id: parsed.data.reportId,
    input_body: parsed.data.body,
  });
  if (result.error) back(parsed.data.reportId, 'failed');
  back(parsed.data.reportId, 'note-added');
}

export async function inspectEvidence(form: FormData) {
  await assertTrustedServerActionOrigin();
  const reportId = reportIdSchema.safeParse(form.get('reportId'));
  const purpose = evidencePurposeSchema.safeParse(form.get('purpose'));
  if (!reportId.success || !purpose.success) redirect('/admin?error=invalid');
  await requireStaffAccess();
  redirect(
    `/admin/reports/${reportId.data}?evidence=visible&purpose=${purpose.data}`,
  );
}

export async function recordDecision(form: FormData) {
  await assertTrustedServerActionOrigin();
  const target = String(form.get('targetState') ?? '');
  const parsed = decisionSchema.safeParse({
    reportId: form.get('reportId'),
    decision: form.get('decision'),
    reason: form.get('reason'),
    rationale: form.get('rationale'),
    targetState: target || null,
    confirmed: form.get('confirmed'),
  });
  if (!parsed.success) redirect('/admin?error=invalid');
  const { client } = await requireStaffAccess();
  const result = await client.rpc('record_moderation_decision', {
    input_report_id: parsed.data.reportId,
    input_decision_code: parsed.data.decision,
    input_reason_code: parsed.data.reason,
    input_rationale: parsed.data.rationale,
    input_target_account_state: parsed.data.targetState,
  });
  if (result.error) back(parsed.data.reportId, 'failed');
  back(parsed.data.reportId, 'decision-recorded');
}

export async function grantStaffRole(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = staffGrantSchema.safeParse({
    userId: form.get('userId'),
    role: form.get('role'),
    reason: form.get('reason'),
  });
  if (!parsed.success) redirect('/admin?error=invalid-role');
  const { client } = await requireStaffAccess();
  const result = await client.rpc('grant_staff_role', {
    input_user_id: parsed.data.userId,
    input_role_code: parsed.data.role,
    input_reason: parsed.data.reason,
  });
  redirect(`/admin?${result.error ? 'error=role' : 'notice=role-granted'}`);
}

export async function revokeStaffRole(form: FormData) {
  await assertTrustedServerActionOrigin();
  const parsed = staffRevokeSchema.safeParse({
    assignmentId: form.get('assignmentId'),
    reason: form.get('reason'),
    confirmed: form.get('confirmed'),
  });
  if (!parsed.success) redirect('/admin?error=invalid-role');
  const { client } = await requireStaffAccess();
  const result = await client.rpc('revoke_staff_role', {
    input_assignment_id: parsed.data.assignmentId,
    input_reason: parsed.data.reason,
  });
  redirect(`/admin?${result.error ? 'error=role' : 'notice=role-revoked'}`);
}
