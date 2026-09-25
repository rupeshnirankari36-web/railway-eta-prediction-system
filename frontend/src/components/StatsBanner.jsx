import React from 'react';

export default function StatsBanner({ trains = [] }) {
  const total = trains.length;
  const onTimeCount = trains.filter(t => (t.current_delay_minutes || 0) <= 5).length;
  const onTimePct = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;
  
  const totalDelay = trains.reduce((sum, t) => sum + (t.current_delay_minutes || 0), 0);
  const avgDelay = total > 0 ? (totalDelay / total).toFixed(1) : 0;
  
  const highPriorityRajdhani = trains.filter(t => t.train_class === 'Rajdhani').length;

  return (
    <div className="stats-banner">
      <div className="stat-card">
        <div className="stat-icon" style={{ color: '#3b82f6' }}>🚄</div>
        <div className="stat-info">
          <div className="stat-label">Active Monitored Trains</div>
          <div className="stat-value">{total} Coaching Rakes</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: '#10b981' }}>⏱️</div>
        <div className="stat-info">
          <div className="stat-label">Fleet Punctuality Rate</div>
          <div className="stat-value" style={{ color: onTimePct >= 75 ? '#10b981' : '#f59e0b' }}>
            {onTimePct}% on-time (&le;5m)
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: '#f59e0b' }}>⚠️</div>
        <div className="stat-info">
          <div className="stat-label">Average Fleet Delay</div>
          <div className="stat-value">{avgDelay} Minutes</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: '#ec4899' }}>👑</div>
        <div className="stat-info">
          <div className="stat-label">High Priority Rajdhani</div>
          <div className="stat-value">{highPriorityRajdhani} Services Active</div>
        </div>
      </div>
    </div>
  );
}
