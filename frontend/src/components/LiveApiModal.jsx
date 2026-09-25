import React, { useState } from 'react';

export default function LiveApiModal({ isOpen, onClose, liveStatus, onRefreshStatus }) {
  if (!isOpen) return null;

  const isLive = liveStatus?.rapidapi_configured;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container api-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-badge-icon">🛰️</span>
            <div>
              <h2>Live Indian Railway API Integration</h2>
              <p>Connect real-time IRCTC / NTES live train tracking to our AI prediction model</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Status Alert */}
          <div className={`status-card ${isLive ? 'status-connected' : 'status-simulated'}`}>
            <div className="status-indicator-dot"></div>
            <div>
              <h4>{isLive ? '🟢 Live API Active: Connected to IRCTC Feed' : '🟠 Local ML Simulation Active'}</h4>
              <p>
                {isLive 
                  ? 'Real-time delay and GPS positions are currently being fetched from Indian Railway servers and fed directly into the XGBoost inference pipeline.'
                  : 'Currently running on trained XGBoost models with physics simulation. You can connect a free RapidAPI key below to track ANY live train in real-time!'}
              </p>
            </div>
          </div>

          {/* Architecture Pipeline Explanation */}
          <div className="pipeline-flow-box">
            <h4>🧠 Real-Time AI Prediction Architecture</h4>
            <div className="flow-steps">
              <div className="flow-step">
                <span className="step-num">1</span>
                <div>
                  <strong>Live IRCTC Stream</strong>
                  <p>Fetches real current delay & GPS coords</p>
                </div>
              </div>
              <span className="flow-arrow">➔</span>
              <div className="flow-step">
                <span className="step-num">2</span>
                <div>
                  <strong>Feature Engineering</strong>
                  <p>Computes headway, weather & time features</p>
                </div>
              </div>
              <span className="flow-arrow">➔</span>
              <div className="flow-step">
                <span className="step-num">3</span>
                <div>
                  <strong>Trained XGBoost Models</strong>
                  <p>Predicts 5-station ETA & delay trends</p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="setup-guide-box">
            <h4>🔑 How to add your RapidAPI Key (100% Free)</h4>
            <ol className="setup-steps-list">
              <li>
                <span>1</span>
                <div>Go to <a href="https://rapidapi.com" target="_blank" rel="noreferrer">rapidapi.com</a> and sign up for a free account.</div>
              </li>
              <li>
                <span>2</span>
                <div>Search for <strong>"IRCTC Train"</strong> or <strong>"Indian Railway"</strong> and click <em>Subscribe to Free Tier</em>.</div>
              </li>
              <li>
                <span>3</span>
                <div>Open or create <code>.env</code> in your project root and add:
                  <div className="code-snippet-box">
                    <code>RAPIDAPI_KEY=your_key_here</code>
                  </div>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>Restart your backend or refresh status below — live data activates instantly!</div>
              </li>
            </ol>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={onRefreshStatus}>
            🔄 Check API Connection
          </button>
        </div>
      </div>
    </div>
  );
}
