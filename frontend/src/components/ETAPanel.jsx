import React from 'react';

export default function ETAPanel({ trainStatus, etaData, loading }) {
  if (loading) {
    return (
      <div className="panel-section">
        <div className="empty-state">
          <div className="pulse-dot" style={{ width: 24, height: 24 }}></div>
          <p>Calculating AI Arrival Forecasts...</p>
        </div>
      </div>
    );
  }

  if (!trainStatus) {
    return (
      <div className="panel-section">
        <div className="empty-state">
          <span className="empty-state-icon">👈</span>
          <p>Select a train from the list or map to view real-time ETA predictions</p>
        </div>
      </div>
    );
  }

  const predictions = etaData?.predictions || [];

  return (
    <div className="panel-section">
      <div className="train-hero">
        <div className="train-hero-top">
          <div>
            <span className="hero-number">TRAIN #{trainStatus.train_id}</span>
            <h2 className="hero-name">{trainStatus.train_name}</h2>
          </div>
          <span className={`class-tag ${trainStatus.train_class?.toLowerCase()}`}>
            {trainStatus.train_class}
          </span>
        </div>

        <div className="current-status-strip">
          <div className="status-box">
            <div className="title">Current Location</div>
            <div className="val">{trainStatus.current_station?.name || trainStatus.current_station?.code || 'En Route'}</div>
          </div>
          <div className="status-box">
            <div className="title">Current Delay</div>
            <div 
              className="val" 
              style={{ 
                color: (trainStatus.current_delay_minutes || 0) > 15 ? '#ef4444' : 
                       (trainStatus.current_delay_minutes || 0) > 5 ? '#f59e0b' : '#10b981' 
              }}
            >
              {(trainStatus.current_delay_minutes || 0) <= 0 
                ? 'On Time' 
                : `+${trainStatus.current_delay_minutes} mins`}
            </div>
          </div>
          <div className="status-box">
            <div className="title">Speed</div>
            <div className="val">{trainStatus.current_speed_kmh || 0} km/h</div>
          </div>
          <div className="status-box">
            <div className="title">Distance Left</div>
            <div className="val">{trainStatus.distance_remaining_km || 0} km</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="panel-header">
          <h3>⏱️ Next 5 Stations ETA Forecast</h3>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Multi-Model XGBoost</span>
        </div>

        {predictions.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>No upcoming station projections found.</p>
        ) : (
          <div className="stations-timeline">
            {predictions.map((p, idx) => {
              const schedTime = new Date(p.scheduled_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const predTime = new Date(p.predicted_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const confidencePct = Math.round((p.confidence_score || 0.8) * 100);
              const uncertainty = p.uncertainty_range?.minutes || 3;

              return (
                <div key={p.station_code || idx} className="timeline-item">
                  <div className="timeline-bullet">{idx + 1}</div>
                  <div className="timeline-content">
                    <div className="timeline-top">
                      <span className="timeline-station-name">{p.station_name} ({p.station_code})</span>
                      <span 
                        className={`timeline-delay-badge ${
                          p.predicted_delay_minutes > 15 ? 'delay-chip major' : 
                          p.predicted_delay_minutes > 5 ? 'delay-chip minor' : 'delay-chip ontime'
                        }`}
                      >
                        +{p.predicted_delay_minutes}m
                      </span>
                    </div>

                    <div className="timeline-times">
                      <span>Sched: {schedTime}</span>
                      <span className="predicted-eta">ETA: {predTime}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>±{uncertainty}m</span>
                    </div>

                    <div className="confidence-indicator">
                      <span>Confidence: {confidencePct}%</span>
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill" 
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
