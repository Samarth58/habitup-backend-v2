import React, { useEffect, useState, useCallback } from 'react';
import {
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
  return <h3 className="section-heading">{icon} <span>{children}</span></h3>;
}

function CompareRow({ label, controlVal, treatmentVal, highlight = false }) {
  return (
    <tr className={highlight ? 'row-highlight' : undefined}>
      <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</td>
      <td className="cell-numeric" style={{ fontWeight: highlight ? 800 : 700 }}>
        {controlVal ?? '—'}
      </td>
      <td className="cell-numeric" style={{ fontWeight: highlight ? 800 : 700 }}>
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

  if (loading && !data) {
    return (
      <div className="content-container">
        <div className="toolbar">
          <div className="toolbar-heading">
            <h2 className="toolbar-title">Friends Feature Experiment</h2>
          </div>
        </div>

        <div className="overview-stack fade-in" aria-busy="true" aria-label="Loading experiment analytics">
          <div className="glass-card">
            <div className="stat-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: '10px' }} />
                  <div className="skeleton" style={{ width: '75%', height: '18px', marginTop: '4px', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="kpi-card">
                <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                <div className="skeleton" style={{ width: '60%', height: '36px', borderRadius: '6px' }} />
                <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: 0 }} />
              </div>
            ))}
          </div>

          <div className="glass-card">
            <div className="skeleton skeleton-title" style={{ width: '30%' }} />
            <div className="skeleton skeleton-chart" style={{ height: '180px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
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

  const experimentFacts = [
    { label: 'Experiment', value: experiment?.name, mono: true },
    { label: 'Allocation', value: `Control ${controlAlloc}% / Treatment ${treatmentAlloc}%` },
    { label: 'Primary Metric', value: experiment?.primaryMetric?.replace('_', ' ') },
    { label: 'Target Sample', value: `${experiment?.targetSampleSize ?? '—'} / variant` },
    {
      label: 'Started',
      value: experiment?.startAt ? new Date(experiment.startAt).toLocaleDateString() : '—',
    },
    { label: 'Total Assigned', value: (control?.users || 0) + (treatment?.users || 0) },
  ];

  const significanceStats = [
    { label: 'Control D7 Retention', value: pct(comparison.controlValue) },
    { label: 'Treatment D7 Retention', value: pct(comparison.treatmentValue) },
    { label: 'Absolute Lift', value: lift(comparison.absoluteLift) },
    { label: 'Relative Lift', value: relativeLift(comparison.relativeLift) },
    { label: 'Z-Score', value: comparison.zScore?.toFixed(3) ?? '—' },
    { label: 'p-value', value: fmtPValue(comparison.pValue) },
    { label: '95% Confidence Interval', value: fmtCI(comparison.confidenceInterval) },
    {
      label: 'Statistical Significance',
      value: <span className={`badge-tag ${significantClass}`}>{significantLabel}</span>,
    },
  ];

  const friendStats = [
    { label: 'Exposure Count', value: friends?.exposureCount ?? 0 },
    { label: 'Exposure Rate', value: pct(friends?.exposureRate) },
    { label: 'Friend Requests Sent', value: friends?.requestsSent ?? 0 },
    { label: 'Request Send Rate', value: pct(friends?.requestSentRate) },
    { label: 'Requests Accepted', value: friends?.requestsAccepted ?? 0 },
    { label: 'Acceptance Rate', value: pct(friends?.requestAcceptanceRate) },
    { label: 'Users with ≥1 Friend', value: friends?.usersWithFriends ?? 0 },
    { label: 'Users with Friends Rate', value: pct(friends?.usersWithFriendsRate) },
    { label: 'Avg Friends per User', value: friends?.avgFriendsPerUser?.toFixed(2) ?? '—' },
  ];

  return (
    <div className="content-container">
      {/* Header */}
      <div className="toolbar">
        <div className="toolbar-heading">
          <h2 className="toolbar-title">Friends Feature Experiment</h2>
          <p className="toolbar-subtitle">
            Variant A: friends disabled &middot; Variant B: friends enabled
          </p>
        </div>
        <div className="filter-group">
          <StatusBadge status={experiment?.status} />
          <button
            id="experiment-refresh-btn"
            className="action-btn"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {/* Allocation & status banner */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.15rem' }}>
        <div className="stat-grid">
          {experimentFacts.map((fact) => (
            <div key={fact.label}>
              <div className="stat-tile-label">{fact.label}</div>
              <div
                className="stat-tile-value"
                style={
                  fact.mono
                    ? { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-primary)' }
                    : undefined
                }
              >
                {fact.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="stats-grid">
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

      {/* Statistical analysis */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.15rem' }}>
        <SectionTitle icon={<Calculator size={18} color="var(--accent-primary)" />}>
          Statistical Significance (D7 Retention)
        </SectionTitle>

        {!comparison?.hasSufficientData ? (
          <div className="inline-warning">
            <AlertTriangle size={16} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Insufficient data:</strong> {comparison?.verdict || 'Collecting sample data.'}
            </div>
          </div>
        ) : (
          <div className="stat-grid">
            {significanceStats.map(({ label, value }) => (
              <div key={label} className="stat-tile">
                <div className="stat-tile-label">{label}</div>
                <div className="stat-tile-value">{value}</div>
              </div>
            ))}
          </div>
        )}

        {comparison?.verdict && comparison?.hasSufficientData && (
          <div className="inline-note">
            <FileText size={15} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{comparison.verdict}</div>
          </div>
        )}
      </div>

      {/* Cohort retention */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.15rem' }}>
        <SectionTitle icon={<BarChart3 size={18} color="var(--accent-primary)" />}>
          Cohort Retention
        </SectionTitle>
        <div className="table-container" style={{ boxShadow: 'none' }}>
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
                <td className="cell-primary">
                  <span className="badge-tag badge-info" style={{ marginRight: '0.4rem' }}>A</span>
                  Control
                </td>
                <td className="cell-numeric">{control?.users ?? 0}</td>
                <td className="tabular-nums">{control?.d1Eligible ?? 0}</td>
                <td className="tabular-nums">{control?.d1Retained ?? 0}</td>
                <td className="cell-numeric" style={{ color: 'var(--accent-primary)' }}>
                  {pct(control?.d1Retention)}
                </td>
                <td className="tabular-nums">{control?.d7Eligible ?? 0}</td>
                <td className="tabular-nums">{control?.d7Retained ?? 0}</td>
                <td className="cell-numeric" style={{ color: 'var(--accent-primary)' }}>
                  {pct(control?.d7Retention)}
                </td>
              </tr>
              <tr className="row-highlight">
                <td className="cell-primary">
                  <span className="badge-tag badge-success" style={{ marginRight: '0.4rem' }}>B</span>
                  Treatment
                </td>
                <td className="cell-numeric">{treatment?.users ?? 0}</td>
                <td className="tabular-nums">{treatment?.d1Eligible ?? 0}</td>
                <td className="tabular-nums">{treatment?.d1Retained ?? 0}</td>
                <td className="cell-numeric" style={{ color: 'var(--accent-success)' }}>
                  {pct(treatment?.d1Retention)}
                </td>
                <td className="tabular-nums">{treatment?.d7Eligible ?? 0}</td>
                <td className="tabular-nums">{treatment?.d7Retained ?? 0}</td>
                <td className="cell-numeric" style={{ color: 'var(--accent-success)' }}>
                  {pct(treatment?.d7Retention)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Habit engagement */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.15rem' }}>
        <SectionTitle icon={<CheckCircle2 size={18} color="var(--accent-success)" />}>
          Habit Engagement
        </SectionTitle>
        <div className="table-container" style={{ boxShadow: 'none' }}>
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

      {/* Friends engagement */}
      <div className="glass-card fade-in">
        <SectionTitle icon={<Users size={18} color="var(--accent-primary)" />}>
          Friends Engagement (Variant B)
        </SectionTitle>
        {(treatment?.users ?? 0) === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={20} />
            </div>
            <div className="empty-state-title">No treatment users yet</div>
            <div className="empty-state-text">
              No users have been assigned to Variant B for this experiment.
            </div>
          </div>
        ) : (
          <div className="stat-grid">
            {friendStats.map(({ label, value }) => (
              <div key={label} className="stat-tile">
                <div className="stat-tile-label">{label}</div>
                <div className="stat-tile-value">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
