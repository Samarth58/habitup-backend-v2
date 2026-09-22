import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical,
  RefreshCw,
  TrendingUp,
  Calculator,
  AlertTriangle,
  FileText,
  BarChart3,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { KPICard } from '../components/KPICard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function lift(n) {
  if (n == null || isNaN(n)) return '—';
  const val = (n * 100).toFixed(1);
  return n >= 0 ? `+${val} pp` : `${val} pp`;
}

function relativeLift(n) {
  if (n == null || isNaN(n)) return '—';
  const val = (n * 100).toFixed(1);
  return n >= 0 ? `+${val}%` : `${val}%`;
}

function fmtPValue(p) {
  if (p == null || isNaN(p)) return '—';
  return p < 0.001 ? '<0.001' : p.toFixed(3);
}

function fmtCI([lo, hi] = []) {
  if (lo == null || hi == null) return '—';
  return `[${(lo * 100).toFixed(1)} pp, ${(hi * 100).toFixed(1)} pp]`;
}

function StatusBadge({ status }) {
  const colours = {
    RUNNING: 'success',
    PAUSED: 'warning',
    COMPLETED: 'info',
  };
  return (
    <span className={`badge-tag badge-${colours[status] || 'primary'}`}>
      {status || 'UNKNOWN'}
    </span>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h3 style={{
      fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem',
      color: 'var(--text-main)', letterSpacing: '-0.2px',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      {icon} <span>{children}</span>
    </h3>
  );
}

function CompareRow({ label, controlVal, treatmentVal, highlight = false }) {
  return (
    <tr style={highlight ? { background: 'var(--accent-primary-light, rgba(79,70,229,0.08))' } : {}}>
      <td style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{label}</td>
      <td className="tabular-nums" style={{ color: 'var(--text-main)', fontWeight: highlight ? 800 : 600 }}>
        {controlVal ?? '—'}
      </td>
      <td className="tabular-nums" style={{ color: 'var(--text-main)', fontWeight: highlight ? 800 : 600 }}>
        {treatmentVal ?? '—'}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExperimentsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setError('');
    api.getExperimentAnalytics('friends_feature_v1')
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load experiment data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="content-container">
        <div style={{ padding: '5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading experiment analytics…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container">
        <div className="error-alert" role="alert">
          <strong>Error:</strong> {error}
          <button
            onClick={loadData}
            style={{ marginLeft: '1rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { experiment, control, treatment, comparison, friends } = data;
  const allocation = experiment?.allocation || { A: 0.5, B: 0.5 };
  const controlAlloc = ((allocation.A || 0.5) * 100).toFixed(0);
  const treatmentAlloc = ((allocation.B || 0.5) * 100).toFixed(0);

  const significantClass = comparison?.significant ? 'badge-success' : 'badge-warning';
  const significantLabel = comparison?.significant ? 'Significant' : 'Not Significant';

  return (
    <div className="content-container">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="toolbar" style={{ marginBottom: '1.25rem' }}>
        <div className="toolbar-heading">
          <h2 className="toolbar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FlaskConical size={20} color="var(--accent-primary)" /> Friends Feature Experiment
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={experiment?.status} />
          <button id="experiment-refresh-btn" className="btn-action" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ─── Allocation & Status Banner ──────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>EXPERIMENT</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {experiment?.name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>ALLOCATION</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
              Control {controlAlloc}% / Treatment {treatmentAlloc}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>PRIMARY METRIC</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', textTransform: 'uppercase' }}>
              {experiment?.primaryMetric?.replace('_', ' ')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>TARGET SAMPLE</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
              {experiment?.targetSampleSize ?? '—'} / variant
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>STARTED</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
              {experiment?.startAt ? new Date(experiment.startAt).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>TOTAL ASSIGNED</div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.05rem' }}>
              {(control?.users || 0) + (treatment?.users || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <KPICard
          title="Control Users"
          value={control?.users ?? 0}
          icon={<span className="badge-tag badge-info" style={{ fontWeight: 800 }}>A</span>}
          badgeText="Variant A"
          badgeType="info"
          note="Friends disabled"
        />
        <KPICard
          title="Treatment Users"
          value={treatment?.users ?? 0}
          icon={<span className="badge-tag badge-success" style={{ fontWeight: 800 }}>B</span>}
          badgeText="Variant B"
          badgeType="success"
          note="Friends enabled"
        />
        <KPICard
          title="D7 Retention Lift"
          value={lift(comparison?.absoluteLift)}
          icon={<TrendingUp size={18} color="var(--accent-primary)" />}
          badgeText={significantLabel}
          badgeType={comparison?.significant ? 'success' : 'warning'}
        />
        <KPICard
          title="p-value"
          value={fmtPValue(comparison?.pValue)}
          icon={<Calculator size={18} color="var(--accent-secondary)" />}
          badgeText={comparison?.hasSufficientData ? 'Z-test' : 'Insufficient data'}
          badgeType={comparison?.hasSufficientData ? 'primary' : 'warning'}
        />
      </div>

      {/* ─── Statistical Analysis ─────────────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.25rem' }}>
        <SectionTitle icon={<Calculator size={18} color="var(--accent-primary)" />}>Statistical Significance (D7 Retention)</SectionTitle>

        {!comparison?.hasSufficientData ? (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
            background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)',
            borderRadius: '10px', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem',
          }}>
            <AlertTriangle size={16} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Insufficient data:</strong> {comparison?.verdict || 'Collecting sample data.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Control D7 Retention', value: pct(comparison.controlValue) },
              { label: 'Treatment D7 Retention', value: pct(comparison.treatmentValue) },
              { label: 'Absolute Lift', value: lift(comparison.absoluteLift) },
              { label: 'Relative Lift', value: relativeLift(comparison.relativeLift) },
              { label: 'Z-Score', value: comparison.zScore?.toFixed(3) ?? '—' },
              { label: 'p-value', value: fmtPValue(comparison.pValue) },
              { label: '95% Confidence Interval', value: fmtCI(comparison.confidenceInterval) },
              { label: 'Statistical Significance', value: <span className={`badge-tag ${significantClass}`}>{comparison.significant ? 'Significant' : 'Not Significant'}</span> },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.75rem', background: 'var(--neutral-input, #f8fafc)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {comparison?.verdict && comparison?.hasSufficientData && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.85rem', padding: '0.75rem 0.9rem', background: 'rgba(79,70,229,0.06)', borderRadius: '8px', fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <FileText size={15} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{comparison.verdict}</div>
          </div>
        )}
      </div>

      {/* ─── Retention Comparison Table ───────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.25rem' }}>
        <SectionTitle icon={<BarChart3 size={18} color="var(--accent-primary)" />}>Cohort Retention</SectionTitle>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cohort</th>
                <th>Assigned</th>
                <th>D1 Eligible</th>
                <th>D1 Retained</th>
                <th>D1 Retention</th>
                <th>D7 Eligible</th>
                <th>D7 Retained</th>
                <th>D7 Retention</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  <span className="badge-tag badge-info" style={{ marginRight: '0.4rem', fontWeight: 700 }}>A</span> Control
                </td>
                <td className="tabular-nums" style={{ fontWeight: 700 }}>{control?.users ?? 0}</td>
                <td className="tabular-nums">{control?.d1Eligible ?? 0}</td>
                <td className="tabular-nums">{control?.d1Retained ?? 0}</td>
                <td className="tabular-nums" style={{ fontWeight: 800, color: 'var(--accent-primary, #4f46e5)' }}>
                  {pct(control?.d1Retention)}
                </td>
                <td className="tabular-nums">{control?.d7Eligible ?? 0}</td>
                <td className="tabular-nums">{control?.d7Retained ?? 0}</td>
                <td className="tabular-nums" style={{ fontWeight: 800, color: 'var(--accent-primary, #4f46e5)' }}>
                  {pct(control?.d7Retention)}
                </td>
              </tr>
              <tr style={{ background: 'var(--accent-primary-light, rgba(79,70,229,0.04))' }}>
                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  <span className="badge-tag badge-success" style={{ marginRight: '0.4rem', fontWeight: 700 }}>B</span> Treatment
                </td>
                <td className="tabular-nums" style={{ fontWeight: 700 }}>{treatment?.users ?? 0}</td>
                <td className="tabular-nums">{treatment?.d1Eligible ?? 0}</td>
                <td className="tabular-nums">{treatment?.d1Retained ?? 0}</td>
                <td className="tabular-nums" style={{ fontWeight: 800, color: 'var(--accent-success, #059669)' }}>
                  {pct(treatment?.d1Retention)}
                </td>
                <td className="tabular-nums">{treatment?.d7Eligible ?? 0}</td>
                <td className="tabular-nums">{treatment?.d7Retained ?? 0}</td>
                <td className="tabular-nums" style={{ fontWeight: 800, color: 'var(--accent-success, #059669)' }}>
                  {pct(treatment?.d7Retention)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Habit Engagement ─────────────────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.25rem' }}>
        <SectionTitle icon={<CheckCircle2 size={18} color="var(--accent-success)" />}>Habit Engagement</SectionTitle>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th><span className="badge-tag badge-info" style={{ marginRight: '0.35rem' }}>A</span> Control</th>
                <th><span className="badge-tag badge-success" style={{ marginRight: '0.35rem' }}>B</span> Treatment</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Total Habits Created" controlVal={control?.totalHabits ?? 0} treatmentVal={treatment?.totalHabits ?? 0} />
              <CompareRow label="Avg Habits per User" controlVal={control?.avgHabitsCreated?.toFixed(2) ?? '—'} treatmentVal={treatment?.avgHabitsCreated?.toFixed(2) ?? '—'} />
              <CompareRow label="Total Completions" controlVal={control?.totalCompletions ?? 0} treatmentVal={treatment?.totalCompletions ?? 0} />
              <CompareRow label="Avg Completions per User" controlVal={control?.avgHabitsCompleted?.toFixed(2) ?? '—'} treatmentVal={treatment?.avgHabitsCompleted?.toFixed(2) ?? '—'} highlight />
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Friends Engagement (Treatment) ──────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.25rem' }}>
        <SectionTitle icon={<Users size={18} color="var(--accent-primary)" />}>Friends Engagement (Variant B)</SectionTitle>
        {(treatment?.users ?? 0) === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
            No Treatment users assigned yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Exposure Count', value: friends?.exposureCount ?? 0 },
              { label: 'Exposure Rate', value: pct(friends?.exposureRate) },
              { label: 'Friend Requests Sent', value: friends?.requestsSent ?? 0 },
              { label: 'Request Send Rate', value: pct(friends?.requestSentRate) },
              { label: 'Requests Accepted', value: friends?.requestsAccepted ?? 0 },
              { label: 'Acceptance Rate', value: pct(friends?.requestAcceptanceRate) },
              { label: 'Users with ≥1 Friend', value: friends?.usersWithFriends ?? 0 },
              { label: 'Users with Friends Rate', value: pct(friends?.usersWithFriendsRate) },
              { label: 'Avg Friends per User', value: friends?.avgFriendsPerUser?.toFixed(2) ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.75rem', background: 'var(--neutral-input, #f8fafc)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
