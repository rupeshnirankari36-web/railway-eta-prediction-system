import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsBanner from './components/StatsBanner';
import TrainList from './components/TrainList';
import Map from './components/Map';
import ETAPanel from './components/ETAPanel';
import DelayBreakdown from './components/DelayBreakdown';
import SimulatorModal from './components/SimulatorModal';
import StationBoard from './components/StationBoard';
import NTESComparisonView from './components/NTESComparisonView';
import LiveApiModal from './components/LiveApiModal';
import { railwayAPI } from './api/railwayAPI';

export default function App() {
  const [currentView, setCurrentView] = useState('MAP');
  const [trains, setTrains] = useState([]);
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);
  const [etaData, setEtaData] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLiveApiOpen, setIsLiveApiOpen] = useState(false);
  const [loadingEta, setLoadingEta] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all trains, system health, and live API status
  const refreshTrains = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [trainList, health, liveApi] = await Promise.all([
        railwayAPI.getAllTrains(),
        railwayAPI.healthCheck(),
        railwayAPI.getLiveApiStatus(),
      ]);

      if (trainList && trainList.length > 0) {
        setTrains(prev => {
          // Preserve any dynamically added trains from live searches
          const existingIds = new Set(trainList.map(t => t.train_id));
          const customTrains = prev.filter(t => !existingIds.has(t.train_id));
          return [...trainList, ...customTrains];
        });

        // If no train selected yet, select first train
        if (!selectedTrainId) {
          setSelectedTrainId(trainList[0].train_id);
        }
      }
      setSystemHealth(health);
      setLiveStatus(liveApi);
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTrainId]);

  // Initial load and periodic refresh
  useEffect(() => {
    refreshTrains();
    const interval = setInterval(refreshTrains, 30000);
    return () => clearInterval(interval);
  }, [refreshTrains]);

  // Fetch selected train telemetry & ETA (using live endpoints if available)
  const fetchSelectedTrainDetails = useCallback(async (trainId) => {
    if (!trainId) return;
    setLoadingEta(true);
    try {
      const [status, eta, explanation] = await Promise.all([
        railwayAPI.getLiveTrainStatus(trainId),
        railwayAPI.getLiveTrainETA(trainId),
        railwayAPI.explainDelay(trainId),
      ]);
      setTrainStatus(status);
      setEtaData(eta);
      setExplanationData(explanation);
    } catch (err) {
      console.error(`Failed to load details for train ${trainId}:`, err);
    } finally {
      setLoadingEta(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTrainId) {
      fetchSelectedTrainDetails(selectedTrainId);
    }
  }, [selectedTrainId, fetchSelectedTrainDetails]);

  const handleSelectTrain = (id) => {
    setSelectedTrainId(id);
  };

  const handleAddLiveTrain = async (trainNumber) => {
    const result = await railwayAPI.searchTrain(trainNumber);
    if (result && result.found) {
      const newTrain = {
        train_id: result.train_id,
        train_name: result.train_name,
        train_class: 'Express',
        route: 'DEL-BOM',
        current_station: {
          code: 'LIVE',
          name: result.current_station || 'En Route',
          latitude: 23.5,
          longitude: 78.5,
        },
        current_delay_minutes: result.current_delay_minutes || 0,
        current_speed_kmh: result.current_speed_kmh || 90,
        distance_remaining_km: 800,
        is_live_data: result.is_live_data || true,
        data_source: result.data_source || 'rapidapi_live',
      };

      setTrains(prev => {
        const filtered = prev.filter(t => t.train_id !== result.train_id);
        return [newTrain, ...filtered];
      });

      setSelectedTrainId(result.train_id);
      return true;
    } else {
      throw new Error(result?.message || 'Train not found');
    }
  };

  const handleSimulationSuccess = () => {
    // Refresh fleet and current train details
    refreshTrains();
    if (selectedTrainId) {
      fetchSelectedTrainDetails(selectedTrainId);
    }
  };

  return (
    <div className="app-container">
      <Navbar 
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenLiveApi={() => setIsLiveApiOpen(true)}
        systemHealth={systemHealth}
        liveStatus={liveStatus}
        onRefresh={refreshTrains}
        isRefreshing={isRefreshing}
      />

      <StatsBanner trains={trains} />

      {currentView === 'STATION_BOARD' ? (
        <StationBoard
          onSelectTrain={(id) => {
            setSelectedTrainId(id);
            setCurrentView('MAP');
          }}
        />
      ) : currentView === 'NTES_COMPARISON' ? (
        <NTESComparisonView
          onSelectTrain={(id) => {
            setSelectedTrainId(id);
            setCurrentView('MAP');
          }}
        />
      ) : (
        <main className="dashboard-content">
          {/* Left: Train Selector & Filters with Live Search */}
          <TrainList
            trains={trains}
            selectedTrainId={selectedTrainId}
            onSelectTrain={handleSelectTrain}
            onAddLiveTrain={handleAddLiveTrain}
          />

          {/* Center: Live Map */}
          <Map
            trains={trains}
            selectedTrainId={selectedTrainId}
            selectedTrainEta={etaData}
            onSelectTrain={handleSelectTrain}
          />

          {/* Right: Real-time ETA Projections & Explainability */}
          <aside className="details-panel">
            <ETAPanel
              trainStatus={trainStatus}
              etaData={etaData}
              loading={loadingEta}
            />

            <DelayBreakdown explanationData={explanationData} />
          </aside>
        </main>
      )}

      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        trains={trains}
        onSimulationSuccess={handleSimulationSuccess}
      />

      <LiveApiModal
        isOpen={isLiveApiOpen}
        onClose={() => setIsLiveApiOpen(false)}
        liveStatus={liveStatus}
        onRefreshStatus={refreshTrains}
      />
    </div>
  );
}

