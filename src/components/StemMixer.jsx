import { useState } from 'react';
import { Settings, Save, Headphones, ChevronLeft } from 'lucide-react';
import './StemMixer.css';

export default function StemMixer({ setActiveView, isMobile, masterVol = 75, setMasterVol, eqBands = { bass: 50, mid: 50, treble: 50 }, setEqBands }) {
  const handleEqChange = (band, newValue) => {
    setEqBands && setEqBands(prev => ({ ...prev, [band]: newValue }));
  };

  const eqPresets = {
    'Flat': { bass: 50, mid: 50, treble: 50 },
    'Bass Boost': { bass: 85, mid: 45, treble: 45 },
    'Acoustic': { bass: 65, mid: 45, treble: 65 },
    'Pop': { bass: 50, mid: 70, treble: 65 },
    'Electronic': { bass: 80, mid: 45, treble: 75 },
    'Rock': { bass: 70, mid: 50, treble: 70 },
  };

  const applyPreset = (presetName) => {
    if (setEqBands && eqPresets[presetName]) {
      setEqBands(eqPresets[presetName]);
    }
  };

  // Mocked gesture handler for mobile pane
  const handleGesturePane = (e, id) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    // Invert y so bottom is 0%, top is 100%
    let percentage = 100 - ((y / height) * 100);
    percentage = Math.max(0, Math.min(100, percentage));
    handleEqChange(id, Math.round(percentage));
  };

  const eqBandsArray = [
    { id: 'bass', label: 'BASS', value: eqBands.bass },
    { id: 'mid', label: 'MID', value: eqBands.mid },
    { id: 'treble', label: 'TREBLE', value: eqBands.treble },
  ];

  return (
    <aside className={`stem-mixer-container ${isMobile ? 'mobile' : ''}`}>
      <div className="mixer-header">
        {isMobile && (
          <button className="nav-icon-btn" onClick={() => setActiveView('home')}>
            <ChevronLeft size={24} />
          </button>
        )}
        <h2>Equalizer</h2>
        <button className="nav-icon-btn" onClick={() => setActiveView('settings')}>
          <Settings size={20} />
        </button>
      </div>

      <div className={`stems-wrapper ${isMobile ? 'gesture-mode' : 'fader-mode'}`}>
        {eqBandsArray.map((band) => (
          <div key={band.id} className="stem-column">
            <div className="stem-label">{band.label}</div>
            <div className="stem-value">{band.value}%</div>
            
            {isMobile ? (
              // Mobile Gesture Zone
              <div 
                className="gesture-zone"
                onPointerDown={(e) => handleGesturePane(e, band.id)}
                onPointerMove={(e) => {
                  if (e.buttons === 1) handleGesturePane(e, band.id);
                }}
              >
                <div className="gesture-fill" style={{ height: `${band.value}%` }}></div>
              </div>
            ) : (
              // Desktop Tactile Fader
              <div className="fader-track">
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={band.value}
                  onChange={(e) => handleEqChange(band.id, parseInt(e.target.value))}
                  className="tactile-fader"
                />
                <div className="fader-glow" style={{ bottom: `${band.value}%` }}></div>
              </div>
            )}
          </div>
        ))}

        {!isMobile && (
          <div className="stem-column master-column">
            <div className="stem-label">MASTER</div>
            <div className="stem-value">{masterVol}%</div>
            <div className="fader-track">
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={masterVol}
                  onChange={(e) => setMasterVol(parseInt(e.target.value))}
                  className="tactile-fader master-fader"
                />
                <div className="fader-glow" style={{ bottom: `${masterVol}%` }}></div>
            </div>
            <Headphones size={20} className="master-icon"/>
          </div>
        )}
      </div>

      <div className="eq-presets-container" style={{ padding: '0 20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>PRESETS</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.keys(eqPresets).map(preset => (
            <button 
              key={preset}
              onClick={() => applyPreset(preset)}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-main)',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-surface)'}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="mixer-footer">
        <button className="save-preset-btn">
          <Save size={16} /> Save Preset
        </button>
      </div>
    </aside>
  );
}
