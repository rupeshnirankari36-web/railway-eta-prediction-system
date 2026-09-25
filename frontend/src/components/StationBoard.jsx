import React, { useState, useEffect } from 'react';
import { railwayAPI } from '../api/railwayAPI';

export default function StationBoard({ onSelectTrain }) {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('NDLS');
  const [boardData, setBoardData] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');

  // Fetch station list
  useEffect(() => {
    const fetchStations = async () => {
      const list = await railwayAPI.getStations();
      setStations(list);
    };
    fetchStations();
  }, []);

  // Fetch board data when selectedStation changes
  useEffect(() => {
    if (!selectedStation) return;
    const fetchBoard = async () => {
      setLoading(true);
      try {
        const data = await railwayAPI.getStationBoard(selectedStation);
        setBoardData(data);
      } catch (err) {
        console.error('Failed to fetch station board:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
    const timer = setInterval(fetchBoard, 20000);
    return () => clearInterval(timer);
  }, [selectedStation]);

  const allTrains = boardData?.board || [];
  const filteredTrains = allTrains.filter((item) => {
    if (filterType === 'ARRIVALS') return item.movement_type === 'Arrival';
    if (filterType === 'DEPARTURES') return item.movement_type === 'Departure';
    if (filterType === 'DELAYED') return item.delay_minutes > 5;
    return true;
  });

  const playAnnouncement = (train) => {
    const msg = `Attention please: Train #${train.train_id} ${train.train_name} from ${train.origin} to ${train.destination} is ${train.delay_minutes <= 0 ? 'arriving on time' : `delayed by ${train.delay_minutes} minutes, expected`} at ${train.predicted_time} on ${train.platform}.`;
    setAnnouncementMsg(msg);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="station-board-container">
      {/* Top Station Selector & Controls */}
      <div className="station-board-header">
        <div className="station-selector-box">
          <span style={{ fontSize: '1.4rem' }}>🚉</span>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Select Railway Junction</div>
            <select
              className="station-select"
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
            >
              {stations.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code}) - {s.platforms} Platforms
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="board-filter-group">
          {['ALL', 'ARRIVALS', 'DEPARTURES', 'DELAYED'].map((type) => (
            <button
              key={type}
              className={`board-filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type === 'ALL' ? 'All Movements' : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Announcement ticker if spoken */}
      {announcementMsg && (
        <div className="announcement-banner">
          <span className="bell-icon">🔔</span>
          <span className="announcement-text">{announcementMsg}</span>
          <button className="dismiss-btn" onClick={() => setAnnouncementMsg('')}>✕</button>
        </div>
      )}

      {/* FIDS Digital LED Board Header */}
      <div className="fids-display-frame">
        <div className="fids-top-bar">
          <div className="fids-title">
            <span className="led-dot"></span>
            <span>INDIAN RAILWAYS DIGITAL DISPLAY SYSTEM • {boardData?.station_name?.toUpperCase() || 'NEW DELHI'} ({selectedStation})</span>
          </div>
          <div className="fids-clock">
            {new Date().toLocaleTimeString()} IST
          </div>
        </div>

        {/* FIDS Table */}
        <div className="fids-table-wrapper">
          <table className="fids-table">
            <thead>
              <tr>
                <th>Train #</th>
                <th>Train Name</th>
                <th>Origin &rarr; Destination</th>
                <th>Platform</th>
                <th>Scheduled</th>
                <th>AI Expected ETA</th>
                <th>Delay</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#f59e0b' }}>
                    <div className="pulse-dot" style={{ display: 'inline-block', marginRight: 10 }}></div>
                    Updating Station Display Board...
                  </td>
                </tr>
              ) : filteredTrains.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No scheduled coaching trains matching criteria at {selectedStation}.
                  </td>
                </tr>
              ) : (
                filteredTrains.map((row) => {
                  const isDelayed = row.delay_minutes > 5;
                  const isCritical = row.delay_minutes > 15;

                  return (
                    <tr key={row.train_id} className={`fids-row ${row.status_code?.toLowerCase()}`}>
                      <td className="col-train-id font-mono">
                        #{row.train_id}
                      </td>
                      <td className="col-train-name">
                        <strong>{row.train_name}</strong>
                        <span className={`class-chip-mini ${row.train_class?.toLowerCase()}`}>
                          {row.train_class}
                        </span>
                      </td>
                      <td className="col-route">
                        {row.origin} &rarr; {row.destination}
                      </td>
                      <td className="col-platform">
                        <span className="platform-pill">{row.platform}</span>
                      </td>
                      <td className="col-sched font-mono">
                        {row.scheduled_time}
                      </td>
                      <td className="col-eta font-mono">
                        <span className="eta-highlight">{row.predicted_time}</span>
                      </td>
                      <td className="col-delay font-mono">
                        <span
                          className={`delay-text ${
                            isCritical ? 'text-danger' : isDelayed ? 'text-warning' : 'text-success'
                          }`}
                        >
                          {row.delay_minutes <= 0 ? 'ON TIME' : `+${row.delay_minutes}m`}
                        </span>
                      </td>
                      <td className="col-status">
                        <span
                          className={`status-chip ${
                            row.status_code === 'AT_PLATFORM'
                              ? 'status-at-platform'
                              : row.status_code === 'ARRIVING'
                              ? 'status-arriving'
                              : isDelayed
                              ? 'status-late'
                              : 'status-ontime'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="col-actions">
                        <button
                          className="btn-action-view"
                          onClick={() => onSelectTrain(row.train_id)}
                          title="View on Map & Full ETA Telemetry"
                        >
                          📍 Track
                        </button>
                        <button
                          className="btn-action-sound"
                          onClick={() => playAnnouncement(row)}
                          title="Simulate Station Audio PA Announcement"
                        >
                          📢 Announce
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
