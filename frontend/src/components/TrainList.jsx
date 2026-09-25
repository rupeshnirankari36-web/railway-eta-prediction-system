import React, { useState, useMemo } from 'react';

export default function TrainList({ trains = [], selectedTrainId, onSelectTrain }) {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');

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

  return (
    <aside className="train-sidebar">
      <div className="search-filter-box">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search train no, name, route..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <p>No trains match criteria</p>
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
                  <span className={`class-tag ${t.train_class?.toLowerCase()}`}>
                    {t.train_class}
                  </span>
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
