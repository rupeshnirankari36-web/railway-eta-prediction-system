import React, { useState, useMemo } from 'react';

export default function TrainList({ 
  trains = [], 
  selectedTrainId, 
  onSelectTrain,
  onAddLiveTrain = () => {}
}) {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [searchingLive, setSearchingLive] = useState(false);
  const [searchMsg, setSearchMsg] = useState(null);

  const filteredTrains = useMemo(() => {
    return trains.filter(t => {
      const matchesSearch = 
        t.train_id.toLowerCase().includes(search.toLowerCase()) ||
        t.train_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.route && t.route.toLowerCase().includes(search.toLowerCase())) ||
        (t.current_station?.name && t.current_station.name.toLowerCase().includes(search.toLowerCase()));

      const matchesClass = filterClass === 'ALL' || t.train_class === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [trains, search, filterClass]);

  const getDelayClass = (delay) => {
    if (delay <= 5) return 'ontime';
    if (delay <= 15) return 'minor';
    return 'major';
  };

  const handleLiveLookup = async () => {
    if (!search.trim()) return;
    setSearchingLive(true);
    setSearchMsg(null);
    try {
      await onAddLiveTrain(search.trim());
    } catch (e) {
      setSearchMsg('Could not find live train');
    } finally {
      setSearchingLive(false);
    }
  };

  return (
    <aside className="train-sidebar">
      <div className="search-filter-box">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search train no (e.g. 12301)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchMsg(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLiveLookup()}
          />
        </div>

        <div className="filter-chips">
          {['ALL', 'Rajdhani', 'Express', 'Passenger'].map((cls) => (
            <button
              key={cls}
              className={`filter-chip ${filterClass === cls ? 'active' : ''}`}
              onClick={() => setFilterClass(cls)}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      <div className="train-list">
        {filteredTrains.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🚆</span>
            <p>No local trains match "{search}"</p>
            {search.trim().length >= 3 && (
              <button 
                className="btn-live-search" 
                onClick={handleLiveLookup}
                disabled={searchingLive}
              >
                {searchingLive ? '🛰️ Querying IRCTC...' : `🛰️ Search Live IRCTC for "${search}"`}
              </button>
            )}
            {searchMsg && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 6 }}>{searchMsg}</p>}
          </div>
        ) : (
          filteredTrains.map((t) => {
            const isSelected = selectedTrainId === t.train_id;
            const delay = t.current_delay_minutes || 0;
            const delayCategory = getDelayClass(delay);

            return (
              <div
                key={t.train_id}
                className={`train-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTrain(t.train_id)}
              >
                <div className="train-header">
                  <span className="train-number">#{t.train_id}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {t.is_live_data && (
                      <span className="live-pill" title="Live IRCTC Data">LIVE</span>
                    )}
                    <span className={`class-tag ${t.train_class?.toLowerCase()}`}>
                      {t.train_class}
                    </span>
                  </div>
                </div>

                <div className="train-title">{t.train_name}</div>

                <div className="train-footer">
                  <span>📍 {t.current_station?.name || t.current_station?.code || 'En Route'}</span>
                  <span className={`delay-chip ${delayCategory}`}>
                    {delay <= 0 ? 'On Time' : `+${delay} min`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

