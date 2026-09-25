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

  /**
   * Get NTES Rule-Based vs IR-ETA XGBoost Comparison for entire train route
   */
  async getNTESComparison(trainId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/ntes/comparison/${trainId}`, {}, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[API] /ntes/comparison/${trainId} fallback`);
      return _fallbackNTESComparison(trainId);
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

function _fallbackNTESComparison(trainId) {
  return {
    train_number: trainId,
    train_name: trainId === '12951' ? 'Mumbai Rajdhani Express' : 'Howrah Rajdhani Express',
    train_class: 'Rajdhani',
    origin: 'HWH',
    destination: 'NDLS',
    total_distance_km: 1450,
    current_station: 'Gaya Junction',
    current_station_code: 'GAYA',
    current_delay_minutes: 14.0,
    comparison_summary: {
      ntes_system_name: 'National Train Enquiry System (Rule-Based Static)',
      ai_system_name: 'IR-ETA XGBoost Multi-Model (Dynamic AI)',
      ntes_destination_delay: 14.0,
      ai_destination_delay: 6.5,
      time_savings_recovered_mins: 7.5,
      historical_benchmark: {
        ntes_baseline_mae_minutes: 22.4,
        ai_model_mae_minutes: 3.82,
        accuracy_improvement_pct: 82.9,
        test_sample_size: 100000,
      },
      key_insight: 'NTES assumes constant +14m delay till New Delhi. IR-ETA AI Model predicts 7.5 mins recovery on the high-speed Kanpur-Delhi trunk section.',
    },
    comparison_table: [
      { station_index: 1, station_code: 'HWH', station_name: 'Howrah Junction', distance_km: 0, platform: 'PF 9', sta: '16:50', std: '16:50', day: 1, status: 'DEPARTED', ntes_expected_time: '16:50', ntes_delay_min: 0, ai_predicted_time: '16:50', ai_predicted_delay_min: 0, delta_min: 0, delta_type: 'MATCHED', confidence: 1.0 },
      { station_index: 2, station_code: 'ASN', station_name: 'Asansol Junction', distance_km: 200, platform: 'PF 4', sta: '18:57', std: '19:00', day: 1, status: 'DEPARTED', ntes_expected_time: '19:05', ntes_delay_min: 8, ai_predicted_time: '19:05', ai_predicted_delay_min: 8, delta_min: 0, delta_type: 'MATCHED', confidence: 1.0 },
      { station_index: 3, station_code: 'DHN', station_name: 'Dhanbad Junction', distance_km: 259, platform: 'PF 3', sta: '19:50', std: '19:55', day: 1, status: 'DEPARTED', ntes_expected_time: '20:04', ntes_delay_min: 14, ai_predicted_time: '20:04', ai_predicted_delay_min: 14, delta_min: 0, delta_type: 'MATCHED', confidence: 1.0 },
      { station_index: 4, station_code: 'GAYA', station_name: 'Gaya Junction', distance_km: 458, platform: 'PF 1', sta: '22:19', std: '22:22', day: 1, status: 'CURRENT_LOCATION', ntes_expected_time: '22:33', ntes_delay_min: 14, ai_predicted_time: '22:33', ai_predicted_delay_min: 14, delta_min: 0, delta_type: 'LIVE_POSITION', confidence: 0.98 },
      { station_index: 5, station_code: 'MGS', station_name: 'Pt. DD Upadhyaya', distance_km: 663, platform: 'PF 2', sta: '00:45', std: '00:55', day: 2, status: 'UPCOMING', ntes_expected_time: '00:59', ntes_delay_min: 14, ai_predicted_time: '00:56', ai_predicted_delay_min: 11, delta_min: 3, delta_type: 'AI_PREDICTS_RECOVERY', confidence: 0.90 },
      { station_index: 6, station_code: 'PRYJ', station_name: 'Prayagraj Junction', distance_km: 816, platform: 'PF 1', sta: '02:33', std: '02:35', day: 2, status: 'UPCOMING', ntes_expected_time: '02:47', ntes_delay_min: 14, ai_predicted_time: '02:42', ai_predicted_delay_min: 9, delta_min: 5, delta_type: 'AI_PREDICTS_RECOVERY', confidence: 0.85 },
      { station_index: 7, station_code: 'CNB', station_name: 'Kanpur Central', distance_km: 1010, platform: 'PF 1', sta: '04:40', std: '04:45', day: 2, status: 'UPCOMING', ntes_expected_time: '04:54', ntes_delay_min: 14, ai_predicted_time: '04:48', ai_predicted_delay_min: 8, delta_min: 6, delta_type: 'AI_PREDICTS_RECOVERY', confidence: 0.80 },
      { station_index: 8, station_code: 'NDLS', station_name: 'New Delhi', distance_km: 1450, platform: 'PF 1', sta: '10:05', std: '10:05', day: 2, status: 'UPCOMING', ntes_expected_time: '10:19', ntes_delay_min: 14, ai_predicted_time: '10:11', ai_predicted_delay_min: 6.5, delta_min: 7.5, delta_type: 'AI_PREDICTS_RECOVERY', confidence: 0.74 }
    ],
    chart_data: [
      { station: 'HWH', distance_km: 0, scheduled_delay: 0, ntes_delay: 0, ai_delay: 0 },
      { station: 'ASN', distance_km: 200, scheduled_delay: 0, ntes_delay: 8, ai_delay: 8 },
      { station: 'DHN', distance_km: 259, scheduled_delay: 0, ntes_delay: 14, ai_delay: 14 },
      { station: 'GAYA', distance_km: 458, scheduled_delay: 0, ntes_delay: 14, ai_delay: 14, is_current: true },
      { station: 'MGS', distance_km: 663, scheduled_delay: 0, ntes_delay: 14, ai_delay: 11 },
      { station: 'PRYJ', distance_km: 816, scheduled_delay: 0, ntes_delay: 14, ai_delay: 9 },
      { station: 'CNB', distance_km: 1010, scheduled_delay: 0, ntes_delay: 14, ai_delay: 8 },
      { station: 'NDLS', distance_km: 1450, scheduled_delay: 0, ntes_delay: 14, ai_delay: 6.5 }
    ]
  };
}

