import Link from 'next/link';
import {
  addNote,
  inspectEvidence,
  openReport,
  recordDecision,
} from '@/modules/moderation/actions';
import { loadModerationReport } from '@/modules/moderation/queries';

type Params = Promise<{ id: string }>;
type Search = Promise<{ evidence?: string; result?: string }>;

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const search = await searchParams;
  const { access, report, history, evidence } = await loadModerationReport(
    id,
    search.evidence === 'visible',
  );
  const isModerator = access.roles.some(
    (role) => role === 'moderator' || role === 'administrator',
  );
  const isOpen = report.state === 'open';
  const inReview = report.state === 'under_review';
  return (
    <main className="admin-container">
      <Link href="/admin">← Report queue</Link>
      <div className="admin-title">
        <div>
          <p className="eyebrow">Safety case</p>
          <h1>{String(report.reason_code).replaceAll('_', ' ')}</h1>
        </div>
        <span className="status-badge status-warning">
          {String(report.state).replaceAll('_', ' ')}
        </span>
      </div>
      {search.result ? (
        <p className="alert-success" role="status">
          The case record was updated.
        </p>
      ) : null}
      <div className="admin-case-grid">
        <section className="admin-panel">
          <h2>Case context</h2>
          <dl className="admin-detail-list">
            <div>
              <dt>Reported account</dt>
              <dd>
                {String(report.reported_display_name)} ·{' '}
                {String(report.reported_account_status)}
              </dd>
            </div>
            <div>
              <dt>Reporter</dt>
              <dd>{String(report.reporter_display_name)}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>
                {String(report.origin_name)} → {String(report.destination_name)}
              </dd>
            </div>
            <div>
              <dt>Booking</dt>
              <dd>
                {String(report.booking_status)} · {String(report.booking_id)}
              </dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>
                {new Date(String(report.submitted_at)).toLocaleString('en-GB')}
              </dd>
            </div>
          </dl>
          <h3>Reporter description</h3>
          <p className="preserve-text">{String(report.description)}</p>
          {isOpen && isModerator ? (
            <form action={openReport}>
              <input type="hidden" name="reportId" value={id} />
              <button className="button" type="submit">
                Start review
              </button>
            </form>
          ) : null}
        </section>
        <section className="admin-panel">
          <h2>Necessary evidence</h2>
          <p className="muted">
            Evidence is hidden until a moderator records an access purpose.
            Access logs store references, never the content.
          </p>
          {isModerator ? (
            <form action={inspectEvidence} className="form-stack">
              <input type="hidden" name="reportId" value={id} />
              <label>
                Access purpose
                <select className="field" name="purpose">
                  <option value="initial_review">Initial review</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="decision_review">Decision review</option>
                  <option value="safety_escalation">Safety escalation</option>
                </select>
              </label>
              <button className="button button-secondary" type="submit">
                Record access and view evidence
              </button>
            </form>
          ) : (
            <p>
              Support can view case metadata but cannot open private evidence.
            </p>
          )}
          {evidence ? (
            <div className="admin-evidence">
              <h3>Item</h3>
              <p>
                <strong>{String(evidence.item_title)}</strong>
              </p>
              <p className="preserve-text">
                {String(evidence.item_description)}
              </p>
              <h3>Declared contents</h3>
              <p className="preserve-text">
                {String(evidence.declared_contents)}
              </p>
              {evidence.handling_notes ? (
                <>
                  <h3>Handling notes</h3>
                  <p className="preserve-text">
                    {String(evidence.handling_notes)}
                  </p>
                </>
              ) : null}
              {evidence.message_body ? (
                <>
                  <h3>Reported message</h3>
                  <blockquote className="preserve-text">
                    {String(evidence.message_body)}
                  </blockquote>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      <section className="admin-panel">
        <h2>Internal history</h2>
        {history.length === 0 ? (
          <p className="muted">No internal notes or decisions yet.</p>
        ) : (
          <ol className="admin-timeline">
            {history.map((entry: unknown) => {
              const item = entry as Record<string, unknown>;
              return (
                <li key={`${String(item.entry_type)}-${String(item.entry_id)}`}>
                  <strong>{String(item.code).replaceAll('_', ' ')}</strong>
                  <p className="preserve-text">{String(item.body)}</p>
                  <time>
                    {new Date(String(item.created_at)).toLocaleString('en-GB')}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
        <form action={addNote} className="form-stack admin-subpanel">
          <input type="hidden" name="reportId" value={id} />
          <label>
            Internal note
            <textarea
              className="field"
              name="body"
              required
              minLength={3}
              maxLength={2000}
              rows={4}
            />
          </label>
          <button className="button button-secondary" type="submit">
            Add internal note
          </button>
        </form>
      </section>
      {inReview && isModerator ? (
        <section className="admin-panel admin-danger-zone">
          <h2>Decision and account action</h2>
          <p>
            Review the affected account and evidence before continuing. Account
            suspension revokes refresh sessions; short-lived access tokens
            remain constrained by live account checks.
          </p>
          <form action={recordDecision} className="form-stack">
            <input type="hidden" name="reportId" value={id} />
            <label>
              Decision
              <select className="field" name="decision">
                <option value="no_action">No action</option>
                <option value="warning_recorded">Warning recorded</option>
                <option value="account_restricted">Restrict account</option>
                <option value="account_suspended">Suspend account</option>
                <option value="account_restored">Restore account</option>
                <option value="report_dismissed">Dismiss report</option>
                <option value="escalation_required">Escalation required</option>
              </select>
            </label>
            <label>
              Account state
              <select className="field" name="targetState">
                <option value="">No account change</option>
                <option value="restricted">Restricted</option>
                <option value="suspended">Suspended</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label>
              Reason code
              <select className="field" name="reason">
                <option value="policy_violation">Policy violation</option>
                <option value="safety_risk">Safety risk</option>
                <option value="harassment">Harassment</option>
                <option value="fraud_risk">Fraud risk</option>
                <option value="prohibited_item">Prohibited item</option>
                <option value="insufficient_evidence">
                  Insufficient evidence
                </option>
                <option value="duplicate_report">Duplicate report</option>
                <option value="resolved_by_support">Resolved by support</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Decision rationale
              <textarea
                className="field"
                name="rationale"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
              />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="confirmed" value="yes" required />I
              confirm this decision applies to{' '}
              {String(report.reported_display_name)} and this report.
            </label>
            <button className="button button-danger" type="submit">
              Record decision
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
