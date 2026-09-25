import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsBanner from './components/StatsBanner';
import TrainList from './components/TrainList';
import Map from './components/Map';
import ETAPanel from './components/ETAPanel';
import DelayBreakdown from './components/DelayBreakdown';
import SimulatorModal from './components/SimulatorModal';
import StationBoard from './components/StationBoard';
import { railwayAPI } from './api/railwayAPI';

export default function App() {
  const [currentView, setCurrentView] = useState('MAP');
  const [trains, setTrains] = useState([]);
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);
  const [etaData, setEtaData] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [loadingEta, setLoadingEta] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all trains and system health
  const refreshTrains = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [trainList, health] = await Promise.all([
        railwayAPI.getAllTrains(),
        railwayAPI.healthCheck(),
      ]);

      if (trainList && trainList.length > 0) {
        setTrains(trainList);
        // If no train selected yet, select first train
        if (!selectedTrainId) {
          setSelectedTrainId(trainList[0].train_id);
        }
      }
      setSystemHealth(health);
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

  // Fetch selected train telemetry & ETA
  const fetchSelectedTrainDetails = useCallback(async (trainId) => {
    if (!trainId) return;
    setLoadingEta(true);
    try {
      const [status, eta, explanation] = await Promise.all([
        railwayAPI.getTrainStatus(trainId),
        railwayAPI.getTrainETA(trainId),
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
        systemHealth={systemHealth}
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
      ) : (
        <main className="dashboard-content">
          {/* Left: Train Selector & Filters */}
          <TrainList
            trains={trains}
            selectedTrainId={selectedTrainId}
            onSelectTrain={handleSelectTrain}
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
    </div>
  );
}
