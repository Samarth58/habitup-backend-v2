import React, { useState, useRef } from 'react';

export function ActivityTrendChart({ data = [], height = 220 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const containerRef = useRef(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No activity recorded for this period.
      </div>
    );
  }

  const svgWidth = 800;
  const svgHeight = height;
  const padding = { top: 20, right: 24, bottom: 32, left: 36 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => Number(d.sessions || 0)), 5);
  // Nice round number for Y-axis ceiling
  const yCeil = Math.ceil(maxVal * 1.15);

  const getX = (index) => {
    if (data.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val) => {
    return padding.top + chartHeight - (Number(val || 0) / yCeil) * chartHeight;
  };

  // Build SVG Path
  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.sessions),
    item: d,
    index: i,
  }));

  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${points[0].x},${padding.top + chartHeight} Z`
    : '';

  // Intelligent label step calculation
  const getLabelStep = (count) => {
    if (count <= 8) return 1;
    if (count <= 16) return 2;
    if (count <= 35) return 5;
    if (count <= 100) return 10;
    return Math.ceil(count / 10);
  };

  const labelStep = getLabelStep(data.length);

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    // If it includes hour like 'YYYY-MM-DD HH:mm'
    if (dateStr.length > 10 && dateStr.includes(' ')) {
      return dateStr.split(' ')[1] || dateStr;
    }
    // Return MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Determine grid lines (0, middle, top)
  const yTicks = [
    { value: 0, y: getY(0) },
    { value: Math.round(yCeil / 2), y: getY(yCeil / 2) },
    { value: yCeil, y: getY(yCeil) },
  ];

  const handleMouseMove = (e) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (mouseX - (padding.left / svgWidth) * rect.width) / ((chartWidth / svgWidth) * rect.width)));
    const index = Math.round(ratio * (data.length - 1));
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
    }
  };

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div
      ref={containerRef}
      className="activity-chart-wrapper"
      style={{ position: 'relative', width: '100%', userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="activity-trend-svg"
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary, #4f46e5)" stopOpacity="0.22" />
            <stop offset="90%" stopColor="var(--accent-primary, #4f46e5)" stopOpacity="0.01" />
            <stop offset="100%" stopColor="var(--accent-primary, #4f46e5)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>

        {/* Y Grid Lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={padding.left + chartWidth}
              y2={tick.y}
              stroke="rgba(226, 232, 240, 0.85)"
              strokeDasharray={i === 0 ? 'none' : '3 3'}
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="var(--text-dim, #94a3b8)"
              className="tabular-nums"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* Area Fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            style={{ transition: 'all 0.2s ease' }}
          />
        )}

        {/* Trend Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'all 0.2s ease' }}
          />
        )}

        {/* X Axis Labels (Filtered to prevent crowding) */}
        {points.map((pt, idx) => {
          const isLast = idx === points.length - 1;
          const isStep = idx % labelStep === 0;
          // Avoid collision with last item if close
          if (!isStep && (!isLast || idx % labelStep > labelStep * 0.6)) {
            return null;
          }

          return (
            <text
              key={idx}
              x={pt.x}
              y={padding.top + chartHeight + 18}
              textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
              fontSize="10.5"
              fontWeight="600"
              fill="var(--text-muted, #64748b)"
              className="tabular-nums"
            >
              {formatDateLabel(pt.item.date)}
            </text>
          );
        })}

        {/* Hover Crosshair and Dot */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={padding.top}
              x2={activePoint.x}
              y2={padding.top + chartHeight}
              stroke="var(--accent-primary, #4f46e5)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.75"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5.5"
              fill="#ffffff"
              stroke="var(--accent-primary, #4f46e5)"
              strokeWidth="3"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(79, 70, 229, 0.35))' }}
            />
          </g>
        )}
      </svg>

      {/* Floating Tooltip */}
      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            position: 'absolute',
            top: '8px',
            left: `${(activePoint.x / svgWidth) * 100}%`,
            transform: activePoint.x > svgWidth * 0.75 ? 'translateX(-100%)' : activePoint.x < svgWidth * 0.25 ? 'translateX(0%)' : 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div className="chart-tooltip-content">
            <div className="tooltip-date">{activePoint.item.date}</div>
            <div className="tooltip-row">
              <span className="tooltip-dot" style={{ background: 'var(--accent-primary)' }}></span>
              <span className="tooltip-label">Sessions:</span>
              <span className="tooltip-value tabular-nums">{activePoint.item.sessions ?? 0}</span>
            </div>
            {activePoint.item.active_users !== undefined && (
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: 'var(--accent-warning)' }}></span>
                <span className="tooltip-label">Active Users:</span>
                <span className="tooltip-value tabular-nums">{activePoint.item.active_users}</span>
              </div>
            )}
            {activePoint.item.estimated_usage_seconds !== undefined && (
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: 'var(--accent-success)' }}></span>
                <span className="tooltip-label">Usage:</span>
                <span className="tooltip-value tabular-nums">{formatSeconds(activePoint.item.estimated_usage_seconds)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DailyUsageChart({ data = [], height = 180 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No daily usage data recorded for this timeframe.
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = height;
  const padding = { top: 16, right: 16, bottom: 28, left: 32 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const maxSessions = Math.max(...data.map((d) => Number(d.sessions || 0)), 4);
  const yCeil = Math.ceil(maxSessions * 1.15);

  const getLabelStep = (count) => {
    if (count <= 8) return 1;
    if (count <= 16) return 2;
    if (count <= 35) return 5;
    if (count <= 100) return 10;
    return Math.ceil(count / 10);
  };

  const labelStep = getLabelStep(data.length);
  const colWidth = chartWidth / data.length;
  const barWidth = Math.max(Math.min(colWidth * 0.65, 24), 3);

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.length > 10 && dateStr.includes(' ')) {
      return dateStr.split(' ')[1] || dateStr;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const yTicks = [
    { value: 0, y: padding.top + chartHeight },
    { value: Math.round(yCeil / 2), y: padding.top + chartHeight / 2 },
    { value: yCeil, y: padding.top },
  ];

  const activeItem = hoveredIndex !== null && data[hoveredIndex] ? data[hoveredIndex] : null;

  return (
    <div
      className="activity-chart-wrapper"
      style={{ position: 'relative', width: '100%', userSelect: 'none' }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="barHoverGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Y Grid Lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={padding.left + chartWidth}
              y2={tick.y}
              stroke="rgba(226, 232, 240, 0.85)"
              strokeDasharray={i === 0 ? 'none' : '3 3'}
              strokeWidth="1"
            />
            <text
              x={padding.left - 6}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="var(--text-dim, #94a3b8)"
              className="tabular-nums"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const sessions = Number(item.sessions || 0);
          const barHeight = Math.max((sessions / yCeil) * chartHeight, sessions > 0 ? 4 : 1.5);
          const x = padding.left + idx * colWidth + (colWidth - barWidth) / 2;
          const y = padding.top + chartHeight - barHeight;
          const isHovered = hoveredIndex === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible touch/hover target */}
              <rect
                x={padding.left + idx * colWidth}
                y={padding.top}
                width={colWidth}
                height={chartHeight + padding.bottom}
                fill="transparent"
              />
              {/* Visible Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={Math.min(barWidth / 2, 4)}
                fill={isHovered ? 'url(#barHoverGradient)' : 'url(#barGradient)'}
                opacity={hoveredIndex === null || isHovered ? 1 : 0.6}
                style={{ transition: 'all 0.15s ease' }}
              />
            </g>
          );
        })}

        {/* X Axis Labels */}
        {data.map((item, idx) => {
          const isLast = idx === data.length - 1;
          const isStep = idx % labelStep === 0;
          if (!isStep && (!isLast || idx % labelStep > labelStep * 0.6)) {
            return null;
          }

          const x = padding.left + idx * colWidth + colWidth / 2;

          return (
            <text
              key={idx}
              x={x}
              y={padding.top + chartHeight + 16}
              textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
              fontSize="10"
              fontWeight="600"
              fill="var(--text-muted, #64748b)"
              className="tabular-nums"
            >
              {formatDateLabel(item.date)}
            </text>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {activeItem && hoveredIndex !== null && (
        <div
          className="chart-tooltip"
          style={{
            position: 'absolute',
            top: '4px',
            left: `${((padding.left + hoveredIndex * colWidth + colWidth / 2) / svgWidth) * 100}%`,
            transform: hoveredIndex > data.length * 0.7 ? 'translateX(-100%)' : hoveredIndex < data.length * 0.3 ? 'translateX(0%)' : 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div className="chart-tooltip-content">
            <div className="tooltip-date">{activeItem.date}</div>
            <div className="tooltip-row">
              <span className="tooltip-dot" style={{ background: 'var(--accent-primary)' }}></span>
              <span className="tooltip-label">Sessions:</span>
              <span className="tooltip-value tabular-nums">{activeItem.sessions ?? 0}</span>
            </div>
            {activeItem.active_users !== undefined && (
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: 'var(--accent-warning)' }}></span>
                <span className="tooltip-label">Active Users:</span>
                <span className="tooltip-value tabular-nums">{activeItem.active_users}</span>
              </div>
            )}
            {activeItem.estimated_usage_seconds !== undefined && (
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: 'var(--accent-success)' }}></span>
                <span className="tooltip-label">Usage:</span>
                <span className="tooltip-value tabular-nums">{formatSeconds(activeItem.estimated_usage_seconds)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivityDistribution({ byType = {} }) {
  const entries = Object.entries(byType);
  const total = entries.reduce((acc, [, count]) => acc + count, 0);

  if (total === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No activity distribution events recorded.
      </div>
    );
  }

  const formatEventType = (type) => {
    if (!type) return 'Unknown';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const colorPalette = [
    '#4f46e5', // Indigo
    '#059669', // Emerald
    '#d97706', // Amber
    '#7c3aed', // Violet
    '#e11d48', // Rose
    '#0284c7', // Sky
    '#0d9488', // Teal
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {entries.map(([type, count], idx) => {
        const percent = Math.round((count / total) * 100);
        const color = colorPalette[idx % colorPalette.length];
        return (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {formatEventType(type)}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>
                {count} ({percent}%)
              </span>
            </div>
            <div className="progress-bar-bg" style={{ marginTop: 0 }}>
              <div
                className="progress-bar-fill"
                style={{
                  '--progress-scale': percent / 100,
                  background: color,
                }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


