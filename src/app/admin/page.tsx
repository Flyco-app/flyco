import Link from 'next/link';
import { MfaSetup } from '@/components/admin/mfa-setup';
import { getServerEnv } from '@/lib/env/server';
import { grantStaffRole, revokeStaffRole } from '@/modules/moderation/actions';
import { loadModerationDashboard } from '@/modules/moderation/queries';

type Search = Promise<{ error?: string; notice?: string }>;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { access, reports, assignments } = await loadModerationDashboard();
  if (!access.aal2) {
    const env = getServerEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
      throw new Error('Supabase Auth is not configured.');
    return (
      <main className="admin-container">
        <MfaSetup
          url={env.SUPABASE_URL}
          publishableKey={env.SUPABASE_PUBLISHABLE_KEY}
        />
      </main>
    );
  }
  const query = await searchParams;
  const isAdmin = access.roles.includes('administrator');
  return (
    <main className="admin-container">
      <div className="admin-title">
        <div>
          <p className="eyebrow">Internal · AAL2 protected</p>
          <h1>Safety report queue</h1>
        </div>
        <span className="status-badge status-success">
          {access.roles.join(', ')}
        </span>
      </div>
      {query.notice ? (
        <p className="alert-success" role="status">
          Staff assignment updated.
        </p>
      ) : null}
      {query.error ? (
        <p className="alert-danger" role="alert">
          The staff operation could not be completed.
        </p>
      ) : null}
      <section className="admin-panel">
        <h2>Reports</h2>
        {reports.length === 0 ? (
          <p className="muted">No reports are waiting for review.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Reason</th>
                  <th>Reported member</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((entry: unknown) => {
                  const report = entry as Record<string, unknown>;
                  return (
                    <tr key={String(report.report_id)}>
                      <td>
                        <time>
                          {new Date(String(report.submitted_at)).toLocaleString(
                            'en-GB',
                          )}
                        </time>
                      </td>
                      <td>{String(report.reason_code).replaceAll('_', ' ')}</td>
                      <td>
                        {String(report.reported_display_name ?? 'Unavailable')}
                      </td>
                      <td>
                        <span className="status-badge status-warning">
                          {String(report.state).replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button button-small"
                          href={`/admin/reports/${String(report.report_id)}`}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {isAdmin ? (
        <section className="admin-panel">
          <h2>Live staff assignments</h2>
          <p className="muted">
            Role changes are effective on the next staff command and are
            audited.
          </p>
          <div className="admin-staff-grid">
            {assignments.map((entry) => {
              const assignment = entry as Record<string, unknown>;
              return (
                <article
                  className="admin-subpanel"
                  key={String(assignment.assignment_id)}
                >
                  <strong>{String(assignment.display_name)}</strong>
                  <p>{String(assignment.role_code)}</p>
                  <form action={revokeStaffRole} className="form-stack">
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={String(assignment.assignment_id)}
                    />
                    <label>
                      Revocation reason
                      <input
                        className="field"
                        name="reason"
                        required
                        minLength={3}
                        maxLength={500}
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        name="confirmed"
                        value="yes"
                        required
                      />
                      Confirm role revocation
                    </label>
                    <button className="button button-danger" type="submit">
                      Revoke role
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
          <form action={grantStaffRole} className="form-stack admin-subpanel">
            <h3>Grant a staff role</h3>
            <label>
              Member UUID
              <input className="field" name="userId" required />
            </label>
            <label>
              Role
              <select className="field" name="role">
                <option value="support">Support</option>
                <option value="moderator">Moderator</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
            <label>
              Reason
              <input
                className="field"
                name="reason"
                required
                minLength={3}
                maxLength={500}
              />
            </label>
            <button className="button" type="submit">
              Grant role
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
