/**
 * Railway ETA API Client
 * Handles all communication with the FastAPI backend.
 * Supports:
 *  - Standard simulation endpoints (/trains/*)
 *  - NEW Live real-time endpoints (/live/*)
 *  - Offline fallback (no backend needed)
 */

const API_BASE = 'http://localhost:8000';

// ==================== FALLBACK DATA ====================

const FALLBACK_TRAINS = [
  {
    train_id: '12301',
    train_name: 'Howrah Rajdhani Express',
    train_class: 'Rajdhani',
    route: 'DEL-KOL',
    current_station: { code: 'CNB', name: 'Kanpur Central', latitude: 26.4535, longitude: 80.3510 },
    current_delay_minutes: 12.0,
    current_speed_kmh: 128.5,
    distance_remaining_km: 1060.0,
    data_source: 'offline_fallback',
    is_live_data: false,
  },
  {
    train_id: '12951',
    train_name: 'Mumbai Rajdhani Express',
    train_class: 'Rajdhani',
    route: 'DEL-BOM',
    current_station: { code: 'BPL', name: 'Bhopal Junction', latitude: 23.2687, longitude: 77.4122 },
    current_delay_minutes: 4.0,
    current_speed_kmh: 124.0,
    distance_remaining_km: 780.0,
    data_source: 'offline_fallback',
    is_live_data: false,
  },
  {
    train_id: '12213',
    train_name: 'Yesvantpur Duronto Express',
    train_class: 'Express',
    route: 'DEL-CHN',
    current_station: { code: 'NGP', name: 'Nagpur Junction', latitude: 21.1458, longitude: 79.0882 },
    current_delay_minutes: 18.0,
    current_speed_kmh: 96.0,
    distance_remaining_km: 1090.0,
    data_source: 'offline_fallback',
    is_live_data: false,
  },
  {
    train_id: '12841',
    train_name: 'Coromandel Express',
    train_class: 'Express',
    route: 'KOL-CHN',
    current_station: { code: 'BZA', name: 'Vijayawada Junction', latitude: 16.5062, longitude: 80.6480 },
    current_delay_minutes: 24.0,
    current_speed_kmh: 88.0,
    distance_remaining_km: 430.0,
    data_source: 'offline_fallback',
    is_live_data: false,
  },
  {
    train_id: '14007',
    train_name: 'Krishak Passenger Express',
    train_class: 'Passenger',
    route: 'DEL-LKO',
    current_station: { code: 'LKO', name: 'Lucknow Charbagh', latitude: 26.8467, longitude: 80.9462 },
    current_delay_minutes: 8.0,
    current_speed_kmh: 52.0,
    distance_remaining_km: 140.0,
    data_source: 'offline_fallback',
    is_live_data: false,
  }
];

// ==================== HELPER ====================

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ==================== API CLIENT ====================

export const railwayAPI = {

  // ---- STANDARD SIMULATION ENDPOINTS ----

  async getAllTrains() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/trains`, {}, 4000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.trains || FALLBACK_TRAINS;
    } catch (err) {
      console.warn('[API] /trains offline, using fallback');
      return FALLBACK_TRAINS;
    }
  },

  async getTrainStatus(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/trains/${trainId}`, {}, 4000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      const match = FALLBACK_TRAINS.find(t => t.train_id === trainId) || FALLBACK_TRAINS[0];
      return { ...match, route_distance_km: 1400, total_stations: 30, last_update: new Date().toISOString() };
    }
  },

  async getTrainETA(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/trains/${trainId}/eta`, {}, 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return _fallbackETA(trainId);
    }
  },

  async explainDelay(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/trains/${trainId}/explain`, {}, 4000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        train_id: trainId, train_name: 'Howrah Rajdhani', current_delay_minutes: 12.0, status: 'delayed',
        delay_breakdown: {
          upstream_delay: { minutes: 5.5, percentage: 46, description: 'Trains ahead blocking junction', icon: '🚂' },
          congestion_delay: { minutes: 3.2, percentage: 27, description: 'Mixed traffic section congestion', icon: '🚦' },
          signal_delay: { minutes: 2.1, percentage: 17, description: 'Signal halts and section clearance', icon: '🔴' },
          weather_delay: { minutes: 1.2, percentage: 10, description: 'Ambient weather impact', icon: '🌡️' }
        },
        feature_importance: [
          { feature: 'delay_vs_class_avg', importance: 0.628, description: 'Deviation from class average' },
          { feature: 'current_delay', importance: 0.287, description: 'Accumulated train delay' },
          { feature: 'delay_trend', importance: 0.068, description: 'Speed recovery trend' },
          { feature: 'upstream_delay', importance: 0.012, description: 'Preceding train headway' }
        ]
      };
    }
  },

  async simulateEvent(trainId, eventType = 'signal_halt', severityMinutes = 10) {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/simulate/event?train_id=${trainId}&event_type=${eventType}&severity_minutes=${severityMinutes}`,
        { method: 'POST' }, 5000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        train_id: trainId, event_type: eventType, severity_minutes: severityMinutes,
        original_delay_minutes: 12.0, new_delay_minutes: 12.0 + severityMinutes,
        affected_stations: [
          { station_code: 'ALD', station_name: 'Prayagraj Junction', additional_delay_minutes: severityMinutes * 0.85 },
          { station_code: 'MGS', station_name: 'Pt. DD Upadhyaya', additional_delay_minutes: severityMinutes * 0.72 },
          { station_code: 'HWH', station_name: 'Howrah Junction', additional_delay_minutes: severityMinutes * 0.50 }
        ]
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/health`, {}, 2000);
      return await res.json();
    } catch (err) {
      return { status: 'demo_mode', models_loaded: true, live_api_configured: false };
    }
  },

  async getStations() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/stations`, {}, 4000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.stations || [];
    } catch (err) {
      return [
        { code: 'NDLS', name: 'New Delhi', platforms: 10 },
        { code: 'CNB', name: 'Kanpur Central', platforms: 6 },
        { code: 'ALD', name: 'Prayagraj Junction', platforms: 6 },
        { code: 'HWH', name: 'Howrah Junction', platforms: 10 },
        { code: 'BOM', name: 'Mumbai Central', platforms: 10 },
        { code: 'MAS', name: 'Chennai Central', platforms: 10 },
        { code: 'BPL', name: 'Bhopal Junction', platforms: 6 },
        { code: 'LKO', name: 'Lucknow Charbagh', platforms: 6 }
      ];
    }
  },

  async getStationBoard(stationCode) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/stations/${stationCode}/board`, {}, 4000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return _fallbackStationBoard(stationCode);
    }
  },

  // ---- NEW LIVE REAL-TIME ENDPOINTS ----

  /**
   * Check if live API is configured (RapidAPI key set).
   * Returns api status object with `rapidapi_configured` flag.
   */
  async getLiveApiStatus() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/live/api-status`, {}, 3000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        rapidapi_configured: false,
        mode: 'backend_offline',
        current_mode_description: 'Backend offline - running in frontend-only demo mode.',
        erail_fallback: false,
      };
    }
  },

  /**
   * Get LIVE real-time position + delay for a specific train.
   * Uses RapidAPI IRCTC if key configured, otherwise ML simulation.
   */
  async getLiveTrainStatus(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/live/train/${trainId}`, {}, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      const match = FALLBACK_TRAINS.find(t => t.train_id === trainId) || FALLBACK_TRAINS[0];
      return { ...match, data_source: 'offline_fallback', is_live_data: false };
    }
  },

  /**
   * Get AI-powered ETA predictions using LIVE real-time delay as input.
   * This is the core SIH feature: Live IRCTC data → XGBoost model → ETA.
   */
  async getLiveTrainETA(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/live/train/${trainId}/eta`, {}, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Fall back to standard simulation endpoint
      return this.getTrainETA(trainId);
    }
  },

  /**
   * Search for ANY Indian Railways train by number.
   * Returns live status if RapidAPI configured, else ML simulation.
   */
  async searchTrain(trainNumber) {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/live/search?train_number=${encodeURIComponent(trainNumber)}`,
        {}, 8000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      const match = FALLBACK_TRAINS.find(t => t.train_id === trainNumber);
      if (match) {
        return { found: true, ...match, data_source: 'offline_fallback', is_live_data: false };
      }
      return { found: false, train_id: trainNumber, message: 'Backend offline - cannot search.' };
    }
  },
};

// ==================== FALLBACK HELPERS ====================

function _fallbackETA(trainId) {
  const now = new Date();
  return {
    train_id: trainId,
    train_name: 'Howrah Rajdhani',
    train_class: 'Rajdhani',
    current_delay_minutes: 12.0,
    data_source: 'offline_fallback',
    is_live_data: false,
    predictions: [
      { station_code: 'CNB', station_name: 'Kanpur Central', latitude: 26.4535, longitude: 80.3510, scheduled_arrival: new Date(now.getTime() + 45*60000).toISOString(), predicted_arrival: new Date(now.getTime() + 57*60000).toISOString(), predicted_delay_minutes: 12.0, confidence_score: 0.94, uncertainty_range: { minutes: 3 } },
      { station_code: 'ALD', station_name: 'Prayagraj Junction', latitude: 25.4358, longitude: 81.8463, scheduled_arrival: new Date(now.getTime() + 140*60000).toISOString(), predicted_arrival: new Date(now.getTime() + 154*60000).toISOString(), predicted_delay_minutes: 14.0, confidence_score: 0.88, uncertainty_range: { minutes: 4 } },
      { station_code: 'MGS', station_name: 'Pt. DD Upadhyaya', latitude: 25.2839, longitude: 83.1179, scheduled_arrival: new Date(now.getTime() + 240*60000).toISOString(), predicted_arrival: new Date(now.getTime() + 255*60000).toISOString(), predicted_delay_minutes: 15.0, confidence_score: 0.82, uncertainty_range: { minutes: 5 } },
      { station_code: 'GAYA', station_name: 'Gaya Junction', latitude: 24.7914, longitude: 85.0002, scheduled_arrival: new Date(now.getTime() + 360*60000).toISOString(), predicted_arrival: new Date(now.getTime() + 373*60000).toISOString(), predicted_delay_minutes: 13.0, confidence_score: 0.77, uncertainty_range: { minutes: 6 } },
      { station_code: 'HWH', station_name: 'Howrah Junction', latitude: 22.5839, longitude: 88.3428, scheduled_arrival: new Date(now.getTime() + 520*60000).toISOString(), predicted_arrival: new Date(now.getTime() + 531*60000).toISOString(), predicted_delay_minutes: 11.0, confidence_score: 0.71, uncertainty_range: { minutes: 7 } }
    ]
  };
}

function _fallbackStationBoard(stationCode) {
  const now = new Date();
  return {
    station_code: stationCode,
    station_name: stationCode === 'NDLS' ? 'New Delhi' : 'Station Junction',
    total_trains: 3,
    board: [
      { train_id: '12301', train_name: 'Howrah Rajdhani', train_class: 'Rajdhani', origin: 'New Delhi', destination: 'Howrah Junction', platform: 'PF 1', movement_type: 'Departure', scheduled_time: '16:55', predicted_time: '17:07', delay_minutes: 12.0, status: 'Delayed (+12m)', status_code: 'DELAYED' },
      { train_id: '12951', train_name: 'Mumbai Rajdhani', train_class: 'Rajdhani', origin: 'Mumbai Central', destination: 'New Delhi', platform: 'PF 3', movement_type: 'Arrival', scheduled_time: '17:15', predicted_time: '17:19', delay_minutes: 4.0, status: 'On Time', status_code: 'ON_TIME' },
      { train_id: '12213', train_name: 'Duronto Express', train_class: 'Express', origin: 'New Delhi', destination: 'Chennai Central', platform: 'PF 5', movement_type: 'Transit', scheduled_time: '17:40', predicted_time: '17:42', delay_minutes: 2.0, status: 'Arriving Soon', status_code: 'ARRIVING' }
    ]
  };
}
