/**
 * Railway ETA API Client
 * Handles all communication with the FastAPI backend
 */

const API_BASE = 'http://localhost:8000';

export const railwayAPI = {
  /**
   * Get status of all tracked trains
   */
  async getAllTrains() {
    try {
      const res = await fetch(`${API_BASE}/trains`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.trains || [];
    } catch (err) {
      console.error('Error fetching trains:', err);
      return [];
    }
  },

  /**
   * Get current status of a specific train
   */
  async getTrainStatus(trainId) {
    try {
      const res = await fetch(`${API_BASE}/trains/${trainId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error fetching train ${trainId}:`, err);
      return null;
    }
  },

  /**
   * Get ETA predictions for next 5 stations
   */
  async getTrainETA(trainId) {
    try {
      const res = await fetch(`${API_BASE}/trains/${trainId}/eta`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error fetching ETA for ${trainId}:`, err);
      return null;
    }
  },

  /**
   * Get delay explanation
   */
  async explainDelay(trainId) {
    try {
      const res = await fetch(`${API_BASE}/trains/${trainId}/explain`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error fetching explanation for ${trainId}:`, err);
      return null;
    }
  },

  /**
   * Simulate a delay event
   */
  async simulateEvent(trainId, eventType = 'signal_halt', severityMinutes = 10) {
    try {
      const res = await fetch(
        `${API_BASE}/simulate/event?train_id=${trainId}&event_type=${eventType}&severity_minutes=${severityMinutes}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error simulating event:`, err);
      return null;
    }
  },

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (err) {
      return { status: 'unreachable' };
    }
  },

  /**
   * Get all stations
   */
  async getStations() {
    try {
      const res = await fetch(`${API_BASE}/stations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.stations || [];
    } catch (err) {
      console.error('Error fetching stations:', err);
      return [];
    }
  },

  /**
   * Get station FIDS display board
   */
  async getStationBoard(stationCode) {
    try {
      const res = await fetch(`${API_BASE}/stations/${stationCode}/board`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error fetching station board for ${stationCode}:`, err);
      return null;
    }
  },
};
