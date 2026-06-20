import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, Maximize2, ListMusic } from 'lucide-react';
import './DockedPlayer.css';

export default function DockedPlayer({ 
  currentTrackA, 
  isPlayingA, 
  togglePlayA, 
  progressA, 
  durationA, 
  onSeekA, 
  currentTrackB, 
  isPlayingB, 
  togglePlayB, 
  progressB, 
  durationB, 
  onSeekB, 
  crossfadeValue, 
  setCrossfadeValue, 
  setActiveView, 
  isShuffle, 
  setIsShuffle, 
  repeatMode, 
  setRepeatMode, 
  playNext, 
  playPrev, 
  volume, 
  setVolume 
}) {
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <footer className="docked-player dual-docked-player">
      {/* DECK A COLUMN */}
      <div className="docked-deck-column deck-a-column">
        <div className="docked-track-info" onClick={() => setActiveView && setActiveView('now-playing')} style={{ cursor: 'pointer' }}>
          <div className="album-art mini-art-a"></div>
          <div className="track-details">
            <span className="title">{currentTrackA ? currentTrackA.title : 'Empty Deck A'}</span>
            <span className="artist">{currentTrackA ? currentTrackA.artist : 'Load a track'}</span>
          </div>
        </div>
        <div className="docked-deck-controls">
          <button 
            className="play-btn mini-play-btn" 
            onClick={togglePlayA}
            disabled={!currentTrackA}
            tabIndex={0}
            title="Play/Pause Deck A"
          >
            {isPlayingA ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </div>

      {/* CENTER MIXER COLUMN */}
      <div className="docked-center-mixer">
        <div className="docked-mixer-controls">
          <button 
            className={`secondary-btn ${isShuffle ? 'active-mode' : ''}`} 
            onClick={() => setIsShuffle(!isShuffle)}
            title="Shuffle"
            tabIndex={0}
          >
            <Shuffle size={16} />
          </button>
          
          <div className="docked-crossfader-wrapper">
            <span className="cf-label">A</span>
            <input 
              type="range" 
              className="docked-crossfader-slider" 
              min="-1" 
              max="1" 
              step="0.05" 
              value={crossfadeValue} 
              onChange={(e) => setCrossfadeValue(Number(e.target.value))}
              tabIndex={0}
              title="Docked Crossfader"
            />
            <span className="cf-label">B</span>
          </div>

          <button 
            className={`secondary-btn ${repeatMode !== 'off' ? 'active-mode' : ''}`}
            onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
            title={`Repeat: ${repeatMode}`}
            tabIndex={0}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        {/* Master Volume */}
        <div className="docked-volume-control">
          <Volume2 size={16} />
          <input 
            type="range" 
            className="volume-slider" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
            tabIndex={0}
            title="Master Volume"
          />
        </div>
      </div>

      {/* DECK B COLUMN */}
      <div className="docked-deck-column deck-b-column">
        <div className="docked-deck-controls">
          <button 
            className="play-btn mini-play-btn" 
            onClick={togglePlayB}
            disabled={!currentTrackB}
            tabIndex={0}
            title="Play/Pause Deck B"
          >
            {isPlayingB ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
        <div className="docked-track-info" onClick={() => setActiveView && setActiveView('now-playing')} style={{ cursor: 'pointer' }}>
          <div className="track-details text-right">
            <span className="title">{currentTrackB ? currentTrackB.title : 'Empty Deck B'}</span>
            <span className="artist">{currentTrackB ? currentTrackB.artist : 'Load a track'}</span>
          </div>
          <div className="album-art mini-art-b"></div>
        </div>
      </div>

      {/* DOCKED ACTIONS RIGHT */}
      <div className="docked-right-actions">
        <button className="expand-btn" onClick={() => setActiveView && setActiveView('queue')} title="Up Next Queue" tabIndex={0}>
          <ListMusic size={18} />
        </button>
        <button className="expand-btn" onClick={() => setActiveView && setActiveView('now-playing')} title="Maximize Player" tabIndex={0}>
          <Maximize2 size={18} />
        </button>
      </div>
    </footer>
  );
}
