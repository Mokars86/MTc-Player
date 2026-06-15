import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, Maximize2, ListMusic } from 'lucide-react';
import './DockedPlayer.css';

export default function DockedPlayer({ currentTrack, isPlaying, togglePlay, progress, duration, onSeek, setActiveView, isShuffle, setIsShuffle, repeatMode, setRepeatMode, playNext, playPrev, volume, setVolume }) {
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <footer className="docked-player">
      <div className="player-left" onClick={() => setActiveView && setActiveView('now-playing')} style={{ cursor: 'pointer' }}>
        <div className="album-art"></div>
        <div className="track-details">
          <span className="title">{currentTrack ? currentTrack.title : 'No Track Selected'}</span>
          <span className="artist">{currentTrack ? currentTrack.artist : '--'}</span>
        </div>
      </div>

      <div className="player-center">
        <div className="controls">
          <button 
            className={`secondary-btn ${isShuffle ? 'active-mode' : ''}`} 
            onClick={() => setIsShuffle(!isShuffle)}
            title="Shuffle"
          >
            <Shuffle size={18} />
          </button>
          <button className="primary-btn" onClick={playPrev}><SkipBack size={24} /></button>
          <button className="play-btn" onClick={togglePlay}>
            {isPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <button className="primary-btn" onClick={playNext}><SkipForward size={24} /></button>
          <button 
            className={`secondary-btn ${repeatMode !== 'off' ? 'active-mode' : ''}`}
            onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <div className="progress-bar">
          <span className="time">{formatTime(progress)}</span>
          <div className="progress-track">
            <input 
              type="range" 
              className="progress-fill" 
              min="0" 
              max={duration || 100} 
              value={progress}
              onChange={(e) => onSeek && onSeek(Number(e.target.value))}
            />
          </div>
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <div className="volume-control">
          <Volume2 size={20} />
          <input 
            type="range" 
            className="volume-slider" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
        <div className="player-right-actions">
          <button className="expand-btn" onClick={() => setActiveView && setActiveView('queue')} title="Up Next Queue" style={{ marginRight: '15px' }}>
            <ListMusic size={20} />
          </button>
          <button className="expand-btn" onClick={() => setActiveView && setActiveView('now-playing')} title="Now Playing View">
            <Maximize2 size={20} />
          </button>
        </div>
      </div>
    </footer>
  );
}
