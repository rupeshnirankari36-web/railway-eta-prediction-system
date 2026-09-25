import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function DelayBreakdown({ explanationData }) {
  if (!explanationData) return null;

  const breakdown = explanationData.delay_breakdown || {};
  const featureImportance = explanationData.feature_importance || [];
  const delayMinutes = explanationData.current_delay_minutes || 0;

  if (delayMinutes <= 1) {
    return (
      <div className="panel-section">
        <div className="panel-header">
          <h3>🎯 Delay Root Cause Analysis</h3>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', color: '#10b981' }}>
          <span style={{ fontSize: '2rem' }}>🎉</span>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>Train is Operating On Time</p>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>No significant upstream bottlenecks or signal congestion detected.</p>
        </div>
      </div>
    );
  }

  // Format data for PieChart
  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];
  const chartData = Object.entries(breakdown).map(([key, val]) => ({
    name: val.description || key,
    value: val.minutes || 0,
    pct: val.percentage || 0,
    icon: val.icon || '⚠️',
  })).filter(d => d.value > 0);

  return (
    <div className="panel-section">
      <div className="panel-header">
        <h3>🔍 Delay Attribution Breakdown</h3>
        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>
          Total: +{delayMinutes}m
        </span>
      </div>

      {chartData.length > 0 && (
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [`${value} min`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Factor list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {chartData.map((item, idx) => (
          <div 
            key={idx} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </span>
            <span style={{ fontWeight: 700, color: '#f3f4f6' }}>
              {item.value}m ({item.pct}%)
            </span>
          </div>
        ))}
      </div>

      {/* Feature Importance SHAP */}
      {featureImportance.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="panel-header">
            <h4 style={{ fontSize: '0.85rem', color: '#93c5fd' }}>📊 AI Decision Factors (SHAP Weights)</h4>
          </div>
          <div className="importance-list">
            {featureImportance.slice(0, 5).map((f, i) => {
              const weightPct = Math.round((f.importance || 0.1) * 100);
              return (
                <div key={i} className="importance-item">
                  <div className="importance-meta">
                    <span style={{ color: '#d1d5db' }}>{f.feature.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#9ca3af', fontWeight: 600 }}>{weightPct}%</span>
                  </div>
                  <div className="importance-track">
                    <div 
                      className="importance-bar" 
                      style={{ width: `${Math.min(100, weightPct * 2.5)}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
