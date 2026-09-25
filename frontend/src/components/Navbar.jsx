import React, { useState, useEffect } from 'react';

export default function Navbar({ 
  currentView = 'MAP', 
  onViewChange = () => {}, 
  onOpenSimulator, 
  onOpenLiveApi,
  systemHealth, 
  liveStatus,
  onRefresh, 
  isRefreshing 
}) {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const isLive = liveStatus?.rapidapi_configured;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <nav className="navbar">
      <div className="brand-section">
        <div className="brand-logo">🚂</div>
        <div className="brand-text">
          <h1>IR-ETA Predict</h1>
          <span>Indian Railways AI Operations Suite • SIH 26028</span>
        </div>
      </div>

      <div className="nav-view-switcher">
        <button
          className={`view-switch-btn ${currentView === 'MAP' ? 'active' : ''}`}
          onClick={() => onViewChange('MAP')}
        >
          🗺️ Fleet Map & ETA
        </button>
        <button
          className={`view-switch-btn ${currentView === 'STATION_BOARD' ? 'active' : ''}`}
          onClick={() => onViewChange('STATION_BOARD')}
        >
          🚉 Station Display Board (FIDS)
        </button>
      </div>

      <div className="nav-actions">
        {/* Live Data / API Status Badge */}
        <button 
          className={`live-api-badge ${isLive ? 'live-active' : 'live-simulated'}`}
          onClick={onOpenLiveApi}
          title="Click to view Live API Connection Settings"
        >
          <div className="pulse-dot" style={{ background: isLive ? '#10b981' : '#f59e0b' }}></div>
          <span>{isLive ? '🛰️ IRCTC Live' : '🤖 ML Neural'}</span>
        </button>

        <div className="time-badge">
          <span>{currentTime}</span>
        </div>

        <button 
          className="map-control-btn" 
          onClick={onRefresh} 
          title="Refresh train data"
          style={{ opacity: isRefreshing ? 0.6 : 1 }}
        >
          🔄 {isRefreshing ? 'Updating...' : 'Sync'}
        </button>

        <button className="btn-simulate" onClick={onOpenSimulator}>
          ⚡ Simulate Disruption
        </button>
      </div>
    </nav>
  );
}

