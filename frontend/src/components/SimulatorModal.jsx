import React, { useState } from 'react';
import { railwayAPI } from '../api/railwayAPI';

export default function SimulatorModal({ isOpen, onClose, trains = [], onSimulationSuccess }) {
  const [selectedTrainId, setSelectedTrainId] = useState(trains[0]?.train_id || '12301');
  const [eventType, setEventType] = useState('signal_halt');
  const [severityMinutes, setSeverityMinutes] = useState(15);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await railwayAPI.simulateEvent(selectedTrainId, eventType, severityMinutes);
      setSimResult(res);
      if (onSimulationSuccess) {
        onSimulationSuccess(res);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Disruption & Cascading Simulator</h3>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Select Target Train:</label>
            <select
              className="form-select"
              value={selectedTrainId}
              onChange={(e) => setSelectedTrainId(e.target.value)}
            >
              {trains.map((t) => (
                <option key={t.train_id} value={t.train_id}>
                  #{t.train_id} - {t.train_name} ({t.train_class})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Event Type:</label>
            <select
              className="form-select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="signal_halt">🔴 Automated Signal Failure / Red Aspect</option>
              <option value="weather">🌧️ Heavy Monsoon Cloudburst / Fog Restriction</option>
              <option value="congestion">🚦 Freight Precedence / Mixed-Traffic Track Congestion</option>
              <option value="loco_failure">⚙️ Traction / Overhead Equipment (OHE) Drop</option>
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <label>Disruption Severity:</label>
              <strong style={{ color: '#f59e0b' }}>+{severityMinutes} Minutes</strong>
            </div>
            <input
              type="range"
              className="form-range"
              min="5"
              max="60"
              step="5"
              value={severityMinutes}
              onChange={(e) => setSeverityMinutes(Number(e.target.value))}
            />
          </div>

          <button
            type="submit"
            className="btn-simulate"
            style={{ padding: '10px 16px', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Evaluating Cascading Delays...' : '⚡ Inject Disruption & Re-predict ETA'}
          </button>
        </form>

        {simResult && (
          <div className="sim-result-box">
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f59e0b', marginBottom: 6 }}>
              ✓ Cascading Propagation Computed
            </div>
            <p style={{ fontSize: '0.78rem', color: '#d1d5db', marginBottom: 8 }}>
              Injected +{simResult.severity_minutes}m into <strong>{simResult.train_name}</strong>. Previous delay: {simResult.original_delay_minutes}m &rarr; Projected delay: {simResult.new_delay_minutes}m.
            </p>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
              Downstream Cascade Impact:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {simResult.affected_stations?.map((st, i) => (
                <div 
                  key={i} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    padding: '3px 6px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.2)'
                  }}
                >
                  <span>{st.station_name} ({st.station_code})</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{st.additional_delay_minutes}m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
