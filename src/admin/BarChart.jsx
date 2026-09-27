import './BarChart.css';

export default function BarChart({ data, highlightLast = true, height = 220 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const chartWidth = 1000;
  const chartHeight = 220;
  const chartPadding = { top: 12, right: 16, bottom: 28, left: 16 };
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const points = data.map((item, index) => ({
    ...item,
    x: data.length === 1 ? chartWidth / 2 : chartPadding.left + (index / (data.length - 1)) * usableWidth,
    y: chartPadding.top + usableHeight - (item.value / max) * usableHeight,
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = `${chartPadding.left},${chartHeight - chartPadding.bottom} ${linePoints} ${chartWidth - chartPadding.right},${chartHeight - chartPadding.bottom}`;

  if (!data.length) return <div className="line-chart-empty" style={{ height }}>No data available</div>;

  return (
    <div className="line-chart" style={{ height }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Trend line chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-chart-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            className="line-chart-gridline"
            x1={chartPadding.left}
            x2={chartWidth - chartPadding.right}
            y1={chartPadding.top + usableHeight * ratio}
            y2={chartPadding.top + usableHeight * ratio}
          />
        ))}
        <polygon className="line-chart-area" points={areaPoints} />
        <polyline className="line-chart-line" points={linePoints} />
        {points.map((point, index) => (
          <circle
            className={`line-chart-point ${highlightLast && index === points.length - 1 ? 'highlighted' : ''}`}
            cx={point.x}
            cy={point.y}
            key={point.label}
            r={highlightLast && index === points.length - 1 ? 5 : 3.5}
          >
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="line-chart-labels">
        {data.map((item) => <span className="mono line-chart-label" key={item.label}>{item.label}</span>)}
      </div>
    </div>
  );
}
