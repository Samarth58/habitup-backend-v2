import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { KPICard } from '../components/KPICard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function lift(n) {
  if (n == null || isNaN(n)) return '—';
  const pct = (n * 100).toFixed(1);
  return n >= 0 ? `+${pct} pp` : `${pct} pp`;
}

function relativeLift(n) {
  if (n == null || isNaN(n)) return '—';
  const pct = (n * 100).toFixed(1);
  return n >= 0 ? `+${pct}%` : `${pct}%`;
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
      fontSize: '1.08rem', fontWeight: 800, marginBottom: '0.35rem',
      color: 'var(--text-main)', letterSpacing: '-0.2px',
    }}>
      {icon} {children}
    </h3>
  );
}

function SectionSubtitle({ children }) {
  return (
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
      {children}
    </p>
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
  const significantLabel = comparison?.significant ? '✅ Significant' : '⏳ Not Significant Yet';

  return (
    <div className="content-container">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="toolbar" style={{ marginBottom: '1.5rem' }}>
        <div className="toolbar-heading">
          <h2 className="toolbar-title">🧪 Friends Feature A/B Experiment</h2>
          <p className="toolbar-subtitle">
            {experiment?.description || 'Randomized A/B test comparing Control (Friends disabled) vs Treatment (Friends enabled).'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={experiment?.status} />
          <button id="experiment-refresh-btn" className="btn-action" onClick={loadData} style={{ fontSize: '0.82rem' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ─── Allocation & Status Banner ──────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>EXPERIMENT ID</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem', color: 'var(--accent-primary, #4f46e5)', fontWeight: 600 }}>
              {experiment?.name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>ALLOCATION</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              Control {controlAlloc}% / Treatment {treatmentAlloc}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>PRIMARY METRIC</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              {experiment?.primaryMetric?.replace('_', ' ')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', marginBottom: '4px' }}>TARGET SAMPLE</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              {experiment?.targetSampleSize ?? '—'} per variant
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
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>
              {(control?.users || 0) + (treatment?.users || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard
          title="Control Users"
          value={control?.users ?? 0}
          icon="🔵"
          badgeText="Variant A"
          badgeType="info"
          note="Friends disabled"
        />
        <KPICard
          title="Treatment Users"
          value={treatment?.users ?? 0}
          icon="🟢"
          badgeText="Variant B"
          badgeType="success"
          note="Friends enabled"
        />
        <KPICard
          title="D7 Retention Lift"
          value={lift(comparison?.absoluteLift)}
          icon="📈"
          badgeText={significantLabel}
          badgeType={comparison?.significant ? 'success' : 'warning'}
        />
        <KPICard
          title="p-value"
          value={fmtPValue(comparison?.pValue)}
          icon="📐"
          badgeText={comparison?.hasSufficientData ? 'Z-test' : 'Insufficient data'}
          badgeType={comparison?.hasSufficientData ? 'primary' : 'warning'}
        />
      </div>

      {/* ─── Statistical Analysis ─────────────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.5rem' }}>
        <SectionTitle icon="📐">Statistical Significance (D7 Retention — Primary Metric)</SectionTitle>
        <SectionSubtitle>
          Two-proportion Z-test comparing Control vs Treatment D7 retention.
          Significance level: α = 0.05.
          Users without completed D7 windows are excluded from the denominator.
        </SectionSubtitle>

        {!comparison?.hasSufficientData ? (
          <div style={{
            background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)',
            borderRadius: '10px', padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.87rem',
          }}>
            ⚠️ <strong>Insufficient data for reliable statistical analysis.</strong>{' '}
            {comparison?.verdict || 'Continue collecting data before drawing conclusions.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Control D7 Retention', value: pct(comparison.controlValue) },
              { label: 'Treatment D7 Retention', value: pct(comparison.treatmentValue) },
              { label: 'Absolute Lift', value: lift(comparison.absoluteLift) },
              { label: 'Relative Lift', value: relativeLift(comparison.relativeLift) },
              { label: 'Z-Score', value: comparison.zScore?.toFixed(3) ?? '—' },
              { label: 'p-value', value: fmtPValue(comparison.pValue) },
              { label: '95% Confidence Interval', value: fmtCI(comparison.confidenceInterval) },
              { label: 'Statistically Significant', value: <span className={`badge-tag ${significantClass}`}>{comparison.significant ? 'YES' : 'NO'}</span> },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.85rem', background: 'var(--neutral-input, #f8fafc)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {comparison?.verdict && comparison?.hasSufficientData && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(79,70,229,0.06)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            📋 {comparison.verdict}
          </div>
        )}
      </div>

      {/* ─── Retention Comparison Table ───────────────────────────────────── */}
      <div className="glass-card fade-in" style={{ marginBottom: '1.5rem' }}>
        <SectionTitle icon="📊">Retention Cohort Breakdown</SectionTitle>
        <SectionSubtitle>
          Exact documented retention windows: Day 1 ([T₀+24h, T₀+48h)) and Day 7 ([T₀+168h, T₀+192h)).
          <strong>Assigned:</strong> total post-launch participants.
          <strong>Eligible:</strong> users who completed the observation window (T₀+48h for D1, T₀+192h for D7).
          <strong>Retained:</strong> eligible users with ≥1 meaningful action in window.
          <strong>Retention %:</strong> Retained / Eligible.
        </SectionSubtitle>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Variant Cohort</th>
                <th>Total Assigned</th>
                <th>D1 Eligible</th>
                <th>D1 Retained</th>
                <th>D1 Retention %</th>
                <th>D7 Eligible</th>
                <th>D7 Retained</th>
                <th>D7 Retention %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  🔵 Control (Variant A)
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Friends Disabled</div>
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
                  🟢 Treatment (Variant B)
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Friends Enabled</div>
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
      <div className="glass-card fade-in" style={{ marginBottom: '1.5rem' }}>
        <SectionTitle icon="✅">Habit Engagement</SectionTitle>
        <SectionSubtitle>
          Habit creation and completion metrics per variant cohort.
        </SectionSubtitle>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>🔵 Control (A)</th>
                <th>🟢 Treatment (B)</th>
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
      <div className="glass-card fade-in" style={{ marginBottom: '1.5rem' }}>
        <SectionTitle icon="🤝">Friends Engagement (Treatment Group — Variant B)</SectionTitle>
        <SectionSubtitle>
          These metrics apply only to Variant B (Friends enabled) users.
          Exposure = user actually viewed the Friends feature UI.
        </SectionSubtitle>
        {(treatment?.users ?? 0) === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '1.5rem 0' }}>
            No Treatment users assigned yet. Data will appear once the experiment collects participants.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
              <div key={label} style={{ padding: '0.85rem', background: 'var(--neutral-input, #f8fafc)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Disclaimer ───────────────────────────────────────────────────── */}
      <div style={{ fontSize: '0.76rem', color: 'var(--text-dim, #94a3b8)', padding: '0 0 2rem 0', lineHeight: 1.6 }}>
        <strong>Note:</strong> This is a <em>randomized A/B experiment</em>. Control and Treatment users are assigned
        concurrently during the experiment period — this is not a before/after (pre/post) analysis. 
        Variant assignment is performed by the backend and cannot be manipulated by the client. 
        Users registered before the experiment start date are not included in either cohort.
        D7 retention uses the exact Day-7 window [T₀+168h, T₀+192h); users who have not yet completed
        their observation window are excluded from the D7 denominator.
      </div>
    </div>
  );
}
