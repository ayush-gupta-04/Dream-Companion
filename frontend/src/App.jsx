import React, { useState, useEffect } from 'react';
import { fetchHealth } from './services/api.js';
import './App.css';

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        setLoading(true);
        const data = await fetchHealth();
        if (isMounted) {
          setHealth(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to connect to backend API');
          setHealth(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-badge">🏏 Foundation Active</div>
        <h1>Live Cricket AI Copilot</h1>
        <p className="subtitle">
          Real-time match intelligence, smart timeline, and grounded conversational analysis.
        </p>
      </header>

      <section className="card">
        <h2>
          API Backend Status:
          {loading && (
            <span className="status-badge loading">
              <span className="pulse-dot"></span> Checking API...
            </span>
          )}
          {!loading && health && (
            <span className="status-badge ok">
              <span className="pulse-dot"></span> Connected (HTTP 200)
            </span>
          )}
          {!loading && error && (
            <span className="status-badge error">
              <span className="pulse-dot"></span> Disconnected
            </span>
          )}
        </h2>

        {error && (
          <p style={{ color: 'var(--accent-error)', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}

        {health && (
          <div className="health-details">
            <div className="detail-item">
              <div className="detail-label">Service</div>
              <div className="detail-value">{health.service}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Environment</div>
              <div className="detail-value">{health.environment}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Uptime</div>
              <div className="detail-value">{health.uptime}s</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Timestamp</div>
              <div className="detail-value">{health.timestamp}</div>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Core MVP Modules</h2>
        <div className="features-grid">
          <div className="feature-box">
            <h3>Ask the Match</h3>
            <p>
              Natural language queries grounded strictly in backend cricket domain statistics and ball-by-ball facts.
            </p>
          </div>
          <div className="feature-box">
            <h3>Catch Me Up</h3>
            <p>
              Contextual recap windows (last wicket, since last over, session join) with quick and detailed views.
            </p>
          </div>
          <div className="feature-box">
            <h3>Smart Match Timeline</h3>
            <p>
              Chronological feed of key moments (wickets, boundaries, milestones) detected with rule-based significance.
            </p>
          </div>
        </div>
      </section>

      <footer className="status-banner">
        Phase 1 Foundation • Node.js + Express (ESM) API • React (JSX) Client
      </footer>
    </div>
  );
}

