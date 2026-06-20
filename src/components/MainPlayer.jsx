import { useState, useEffect, useRef } from 'react';
import { LayoutGrid, List, Loader2, Disc3, PlayCircle, Trash2, AlertTriangle, MoreVertical, Plus, ChevronLeft, SlidersHorizontal, ListMusic, Clock, Play, Pause, Volume2, HardDrive, CheckSquare, Square } from 'lucide-react';
import { audioService } from '../services/audioService';
import { localAudioService } from '../services/localAudioService';
import { get, set } from 'idb-keyval';
import './MainPlayer.css';

export default function MainPlayer({ 
  onLeftSwipe, 
  onRightSwipe, 
  isMobile, 
  refreshTrigger, 
  activeView, 
  currentTrackA, 
  isPlayingA, 
  progressA, 
  durationA, 
  volumeA, 
  setVolumeA, 
  togglePlayA, 
  seekA, 
  currentTrackB, 
  isPlayingB, 
  progressB, 
  durationB, 
  volumeB, 
  setVolumeB, 
  togglePlayB, 
  seekB, 
  crossfadeValue, 
  setCrossfadeValue, 
  onPlayTrack, 
  theme, 
  setTheme, 
  onLibraryClear, 
  searchQuery, 
  queue, 
  setQueue, 
  sleepTimer, 
  setSleepTimer, 
  analyserNodeRef, 
  setActiveView 
}) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(null); // track id whose submenu is open
  const [visualizerType, setVisualizerType] = useState('bars'); // 'bars', 'waveform', 'circle', 'disc'
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const canvasRef = useRef(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedTrackToLoad, setSelectedTrackToLoad] = useState(null);

  const handleKeyDown = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(e);
    }
  };

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const saved = await get('mtc_playlists');
        if (saved) {
          setPlaylists(saved);
        }
      } catch (err) {
        console.error('Failed to load playlists in MainPlayer:', err);
      }
    };
    loadPlaylists();
  }, [activeView]);

  // Visualizer Logic
  useEffect(() => {
    if (activeView !== 'now-playing' || !analyserNodeRef || !analyserNodeRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const analyser = analyserNodeRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationId;
    
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#45A29E';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (visualizerType === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];
          ctx.fillStyle = primaryColor;
          ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
          x += barWidth + 1;
        }
      } else if (visualizerType === 'waveform') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.lineWidth = 3;
        ctx.strokeStyle = primaryColor;
        ctx.beginPath();
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } else if (visualizerType === 'circle') {
        analyser.getByteFrequencyData(dataArray);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 40;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] / 2;
          const rads = (Math.PI * 2 / bufferLength) * i;
          const x = centerX + Math.cos(rads) * radius;
          const y = centerY + Math.sin(rads) * radius;
          const xEnd = centerX + Math.cos(rads) * (radius + barHeight);
          const yEnd = centerY + Math.sin(rads) * (radius + barHeight);
          
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(xEnd, yEnd);
          ctx.stroke();
        }
      } else if (visualizerType === 'fire') {
        analyser.getByteFrequencyData(dataArray);
        const width = canvas.width;
        const height = canvas.height;
        const numFlames = Math.min(bufferLength, 60);
        const flameWidth = width / numFlames;
        
        for (let i = 0; i < numFlames; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const flameHeight = percent * height * 0.95;
          const x = i * flameWidth;
          const y = height;
          
          const grad = ctx.createLinearGradient(x, y, x, y - flameHeight);
          grad.addColorStop(0, 'rgba(255, 0, 0, 0.85)');
          grad.addColorStop(0.3, 'rgba(255, 100, 0, 0.9)');
          grad.addColorStop(0.7, 'rgba(255, 200, 0, 0.95)');
          grad.addColorStop(1, 'rgba(255, 255, 200, 1)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + flameWidth / 2, y - flameHeight * 1.1, x + flameWidth, y);
          ctx.closePath();
          ctx.fill();
          
          if (value > 150 && Math.random() > 0.85) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(x + Math.random() * flameWidth, y - flameHeight - Math.random() * 20, Math.random() * 3 + 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    
    draw();
    
    return () => cancelAnimationFrame(animationId);
  }, [activeView, analyserNodeRef, visualizerType]);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    async function loadTracks() {
      setIsLoading(true);
      try {
        const [onlineData, localData] = await Promise.all([
          audioService.fetchTracks(),
          localAudioService.fetchTracks()
        ]);

        const formattedOnlineTracks = onlineData
          .filter(f => !f.name.startsWith('.'))
          .map((file, index) => ({
            id: `online_${file.id || index}`,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'MTc User',
            dur: '--:--',
            fileName: file.name,
            source: 'online'
          }));
          
        const formattedLocalTracks = localData.map(file => ({
            id: file.id,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Local Device',
            dur: '--:--',
            fileName: file.id, // We use the IndexedDB key as the unique identifier for local files
            file: file.file,
            source: 'local'
        }));

        setTracks([...formattedLocalTracks, ...formattedOnlineTracks]);
      } catch (error) {
        console.error("Failed to load tracks:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTracks();
  }, [refreshTrigger]);

  const handleDelete = async (e, track) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${track.title}?`)) return;
    try {
      if (track.source === 'local') {
        await localAudioService.deleteTrack(track.fileName);
      } else {
        await audioService.deleteTrack(track.fileName);
      }
      setTracks(tracks.filter(t => t.id !== track.id));
    } catch (err) {
      alert("Failed to delete track");
    }
  };

  const handleClearLibrary = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete ALL tracks from your library?")) return;
    try {
      setIsLoading(true);
      await audioService.clearLibrary();
      setTracks([]);
      if (onLibraryClear) onLibraryClear();
    } catch (err) {
      alert("Failed to clear library");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToPlaylist = async (e, track, playlistId) => {
    e.stopPropagation();
    try {
      const playlistsData = (await get('mtc_playlists')) || [];
      const targetPlaylist = playlistsData.find(p => p.id === playlistId);
      if (targetPlaylist) {
        if (!targetPlaylist.tracks) targetPlaylist.tracks = [];
        if (!targetPlaylist.tracks.includes(track.fileName)) {
          targetPlaylist.tracks.push(track.fileName);
          await set('mtc_playlists', playlistsData);
          setPlaylists(playlistsData);
          alert(`Added ${track.title} to ${targetPlaylist.name}`);
        } else {
          alert("Track is already in this playlist.");
        }
      }
    } catch (err) {
      console.error('Failed to add to playlist:', err);
    }
    setActiveMenuId(null);
    setShowAddToPlaylist(null);
  };

  const handleAddMultipleToPlaylist = async (playlistId) => {
    try {
      const playlistsData = (await get('mtc_playlists')) || [];
      const targetPlaylist = playlistsData.find(p => p.id === playlistId);
      if (targetPlaylist) {
        if (!targetPlaylist.tracks) targetPlaylist.tracks = [];
        let addedCount = 0;
        selectedTracks.forEach(trackId => {
          const track = tracks.find(t => t.id === trackId);
          if (track && !targetPlaylist.tracks.includes(track.fileName)) {
            targetPlaylist.tracks.push(track.fileName);
            addedCount++;
          }
        });
        await set('mtc_playlists', playlistsData);
        setPlaylists(playlistsData);
        alert(`Added ${addedCount} tracks to ${targetPlaylist.name}`);
      }
    } catch (err) {
      console.error('Failed to add multiple to playlist:', err);
    }
    setIsSelectMode(false);
    setSelectedTracks([]);
    setActiveMenuId(null);
    setShowAddToPlaylist(null);
  };

  const toggleTrackSelection = (e, trackId) => {
    e.stopPropagation();
    if (selectedTracks.includes(trackId)) {
      setSelectedTracks(selectedTracks.filter(id => id !== trackId));
    } else {
      setSelectedTracks([...selectedTracks, trackId]);
    }
  };

  // Filter tracks by active playlist and search query
  const getFilteredTracks = () => {
    let filtered = [...tracks];
    
    // Filter by Playlist if activeView is a playlist
    if (activeView.startsWith('playlist-')) {
      const playlistId = activeView.split('-')[1];
      const targetPlaylist = playlists.find(p => p.id === playlistId);
      if (targetPlaylist && targetPlaylist.tracks) {
        filtered = filtered.filter(t => targetPlaylist.tracks.includes(t.fileName));
      } else {
        filtered = [];
      }
    }

    // Filter by Search
    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const filteredTracks = getFilteredTracks();

  const renderHomeDashboard = () => (
    <div className="home-dashboard">
      <div className="home-section">
        <h3>Quick Picks</h3>
        <div className="cards-grid">
          {tracks.slice(0, 4).map(track => (
            <div 
              key={track.id} 
              className="track-card" 
              onClick={() => setSelectedTrackToLoad(track)}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, () => setSelectedTrackToLoad(track))}
            >
              <div className="card-art">
                <PlayCircle size={32} className="play-icon" />
              </div>
              <span className="card-title">{track.title}</span>
            </div>
          ))}
          {tracks.length === 0 && <div className="empty-state">No tracks uploaded yet.</div>}
        </div>
      </div>
      <div className="home-section">
        <h3>Your Playlists</h3>
        <div className="cards-grid">
          {playlists.map(p => (
             <div 
               key={p.id} 
               className="track-card playlist-card" 
               onClick={() => setActiveView && setActiveView(`playlist-${p.id}`)}
               tabIndex={0}
               onKeyDown={(e) => handleKeyDown(e, () => setActiveView && setActiveView(`playlist-${p.id}`))}
             >
               <div className="card-art"><Disc3 size={32} /></div>
               <span className="card-title">{p.name}</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNowPlaying = () => {
    const radius = 95;
    const circumference = 2 * Math.PI * radius;
    const dashOffsetA = durationA > 0 ? circumference - (progressA / durationA) * circumference : circumference;
    const dashOffsetB = durationB > 0 ? circumference - (progressB / durationB) * circumference : circumference;

    const formatTime = (time) => {
      if (!time || isNaN(time)) return '0:00';
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div className="now-playing-view dual-deck-view">
        <div className="decks-container">
          {/* DECK A */}
          <div className="deck-panel deck-panel-a" tabIndex={0}>
            <div className="deck-header">
              <span className="deck-badge badge-a">Deck A</span>
            </div>
            
            <div className="deck-disc-section">
              <div className={`virtual-disc-container ${isPlayingA ? 'spinning' : ''}`}>
                <svg viewBox="0 0 220 220" className="disc-progress-ring">
                  <defs>
                    <mask id="progress-mask-a">
                      <circle
                        stroke="white"
                        strokeWidth="10"
                        strokeDasharray={`${circumference} ${circumference}`}
                        style={{ strokeDashoffset: dashOffsetA }}
                        fill="transparent"
                        r={radius}
                        cx="110"
                        cy="110"
                      />
                    </mask>
                  </defs>
                  <circle
                    stroke="var(--color-surface)"
                    strokeWidth="8"
                    strokeDasharray="8 6"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                  />
                  <circle
                    stroke="var(--color-primary)"
                    strokeWidth="8"
                    strokeDasharray="8 6"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                    mask="url(#progress-mask-a)"
                  />
                </svg>
                <div className="virtual-disc" style={{background: '#111'}}>
                  <div className="grooves"></div>
                  <div className="glass-glare"></div>
                  <div className="disc-center" style={{background: 'var(--color-primary)', width: '60px', height: '60px', border: '3px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                     <div className="disc-hole" style={{zIndex: 2, width: '10px', height: '10px', background: '#000'}}></div>
                     <span style={{color: 'white', fontWeight: '900', fontSize: '8px', marginTop: '6px', letterSpacing: '0px'}}>Deck A</span>
                  </div>
                </div>
                <div className="disc-shadow"></div>
              </div>
            </div>

            <div className="deck-info">
              <h2 className="deck-track-title">{currentTrackA ? currentTrackA.title : 'Empty Deck A'}</h2>
              <h3 className="deck-track-artist">{currentTrackA ? currentTrackA.artist : 'Load a track'}</h3>
            </div>

            <div className="deck-controls">
              <button 
                className="deck-control-btn play-pause-btn" 
                onClick={togglePlayA}
                disabled={!currentTrackA}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, togglePlayA)}
                title="Play/Pause A"
              >
                {isPlayingA ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <div className="deck-volume-wrapper">
                <Volume2 size={16} style={{ flexShrink: 0 }} />
                <input 
                  type="range"
                  className="deck-volume-slider"
                  min="0"
                  max="100"
                  value={volumeA}
                  onChange={(e) => setVolumeA(Number(e.target.value))}
                  tabIndex={0}
                  title="Deck A Volume"
                />
                <span className="volume-label">{volumeA}%</span>
              </div>
            </div>

            <div className="deck-progress">
              <span className="time">{formatTime(progressA)}</span>
              <input 
                type="range"
                className="deck-progress-slider"
                min="0"
                max={durationA || 100}
                value={progressA}
                onChange={(e) => seekA(Number(e.target.value))}
                disabled={!currentTrackA}
                tabIndex={0}
                title="Deck A Progress"
              />
              <span className="time">{formatTime(durationA)}</span>
            </div>
          </div>

          {/* DECK B */}
          <div className="deck-panel deck-panel-b" tabIndex={0}>
            <div className="deck-header">
              <span className="deck-badge badge-b">Deck B</span>
            </div>
            
            <div className="deck-disc-section">
              <div className={`virtual-disc-container ${isPlayingB ? 'spinning' : ''}`}>
                <svg viewBox="0 0 220 220" className="disc-progress-ring">
                  <defs>
                    <mask id="progress-mask-b">
                      <circle
                        stroke="white"
                        strokeWidth="10"
                        strokeDasharray={`${circumference} ${circumference}`}
                        style={{ strokeDashoffset: dashOffsetB }}
                        fill="transparent"
                        r={radius}
                        cx="110"
                        cy="110"
                      />
                    </mask>
                  </defs>
                  <circle
                    stroke="var(--color-surface)"
                    strokeWidth="8"
                    strokeDasharray="8 6"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                  />
                  <circle
                    stroke="var(--color-primary)"
                    strokeWidth="8"
                    strokeDasharray="8 6"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                    mask="url(#progress-mask-b)"
                  />
                </svg>
                <div className="virtual-disc" style={{background: '#111'}}>
                  <div className="grooves"></div>
                  <div className="glass-glare"></div>
                  <div className="disc-center" style={{background: 'var(--color-primary)', width: '60px', height: '60px', border: '3px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                     <div className="disc-hole" style={{zIndex: 2, width: '10px', height: '10px', background: '#000'}}></div>
                     <span style={{color: 'white', fontWeight: '900', fontSize: '8px', marginTop: '6px', letterSpacing: '0px'}}>Deck B</span>
                  </div>
                </div>
                <div className="disc-shadow"></div>
              </div>
            </div>

            <div className="deck-info">
              <h2 className="deck-track-title">{currentTrackB ? currentTrackB.title : 'Empty Deck B'}</h2>
              <h3 className="deck-track-artist">{currentTrackB ? currentTrackB.artist : 'Load a track'}</h3>
            </div>

            <div className="deck-controls">
              <button 
                className="deck-control-btn play-pause-btn" 
                onClick={togglePlayB}
                disabled={!currentTrackB}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, togglePlayB)}
                title="Play/Pause B"
              >
                {isPlayingB ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <div className="deck-volume-wrapper">
                <Volume2 size={16} style={{ flexShrink: 0 }} />
                <input 
                  type="range"
                  className="deck-volume-slider"
                  min="0"
                  max="100"
                  value={volumeB}
                  onChange={(e) => setVolumeB(Number(e.target.value))}
                  tabIndex={0}
                  title="Deck B Volume"
                />
                <span className="volume-label">{volumeB}%</span>
              </div>
            </div>

            <div className="deck-progress">
              <span className="time">{formatTime(progressB)}</span>
              <input 
                type="range"
                className="deck-progress-slider"
                min="0"
                max={durationB || 100}
                value={progressB}
                onChange={(e) => seekB(Number(e.target.value))}
                disabled={!currentTrackB}
                tabIndex={0}
                title="Deck B Progress"
              />
              <span className="time">{formatTime(durationB)}</span>
            </div>
          </div>
        </div>

        {/* MIXER PANEL */}
        <div className="mixer-panel">
          <div className="crossfader-container">
            <span className="crossfade-side-label">A</span>
            <input 
              type="range"
              className="crossfader-slider"
              min="-1"
              max="1"
              step="0.01"
              value={crossfadeValue}
              onChange={(e) => setCrossfadeValue(Number(e.target.value))}
              tabIndex={0}
              title="Crossfader"
            />
            <span className="crossfade-side-label">B</span>
          </div>
          <div className="crossfader-center-badge">Crossfader</div>

          <div className="visualizer-controls" style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0 10px 0' }}>
             <button onClick={() => setVisualizerType('bars')} style={{ background: visualizerType === 'bars' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'bars' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }} tabIndex={0}>Bars</button>
             <button onClick={() => setVisualizerType('waveform')} style={{ background: visualizerType === 'waveform' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'waveform' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }} tabIndex={0}>Waveform</button>
             <button onClick={() => setVisualizerType('circle')} style={{ background: visualizerType === 'circle' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'circle' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }} tabIndex={0}>Circle</button>
             <button onClick={() => setVisualizerType('fire')} style={{ background: visualizerType === 'fire' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'fire' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }} tabIndex={0}>Fire</button>
             <button onClick={() => setVisualizerType('disc')} style={{ background: visualizerType === 'disc' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'disc' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }} tabIndex={0}>Disc</button>
          </div>
        </div>

        {/* SHARED CANVAS VISUALIZER */}
        {visualizerType !== 'disc' && (
          <div className="shared-visualizer-container">
            <canvas ref={canvasRef} width="600" height="180" className="mixer-canvas-visualizer"></canvas>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsDashboard = () => (
    <div className="settings-dashboard">
      <div className="header-section">
        <h2>SETTINGS</h2>
      </div>
      <div className="settings-grid">
        <div className="settings-card">
          <h3>Appearance</h3>
          <div className="setting-item">
            <span>Theme Accent Color</span>
            <select className="settings-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="theme-luminous-teal">Luminous Teal</option>
              <option value="theme-neon-purple">Neon Purple</option>
              <option value="theme-crimson-red">Crimson Red</option>
              <option value="theme-vlc-orange">VLC Orange</option>
              <option value="theme-classic-red">Classic Red</option>
              <option value="theme-day-mode">Day Mode (Light)</option>
            </select>
          </div>
          <div className="setting-item">
            <span>Sleep Timer</span>
            <select className="settings-select" 
              value={sleepTimer ? Math.round((sleepTimer - Date.now())/60000) : "off"} 
              onChange={(e) => {
                if (e.target.value === "off") setSleepTimer(null);
                else setSleepTimer(Date.now() + parseInt(e.target.value) * 60000);
              }}>
              <option value="off">Off</option>
              <option value="1">1 Minute (Test)</option>
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">60 Minutes</option>
            </select>
          </div>
        </div>
        <div className="settings-card">
          <h3>Audio Preferences</h3>
          <div className="setting-item">
            <span>High Quality Streaming</span>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <span>Gapless Playback</span>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        <div className="settings-card">
          <h3>Storage Usage</h3>
          <div className="storage-info">
            <div className="storage-bar">
              <div className="storage-fill" style={{ width: '45%' }}></div>
            </div>
            <span>1.2 GB / 5 GB Used</span>
          </div>
        </div>
        <div className="settings-card">
          <h3>Account</h3>
          <div className="setting-item">
            <span>Logged in as Anon</span>
            <button className="settings-btn">Sign Out</button>
          </div>
        </div>
        <div className="settings-card">
          <h3>Support MTc Player</h3>
          <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            <span>Enjoying the app? Buy me a coffee! ☕</span>
            <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '6px', width: '100%', border: '1px solid var(--color-border)', lineHeight: '1.5' }}>
              <strong>MTN Mobile Money</strong><br/>
              <span style={{ color: 'var(--color-primary)' }}>Number: 0546920418</span><br/>
              <span style={{ color: 'var(--color-text-muted)' }}>Name: Mubarick Tahiru</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrackListHeader = () => (
    <div className="track-list-header">
      <span>TITLE</span>
      <span>ARTIST</span>
      <span style={{ textAlign: 'right', paddingRight: '10px' }}>TIME</span>
    </div>
  );

  const displayTracks = activeView === 'queue' ? queue : filteredTracks;

  return (
    <main className="main-player-container">
      {isMobile && (
        <div className="mobile-nav-header">
          <button className="nav-icon-btn" onClick={onLeftSwipe}>
            <ChevronLeft size={24} />
          </button>
          <span className="nav-title">
            {activeView === 'queue' ? 'Up Next' : 
             activeView === 'settings' ? 'Settings' : 
             activeView === 'now-playing' ? 'Now Playing' : 
             activeView === 'home' ? 'Home' : 'MTc Player'}
          </span>
          <button className="nav-icon-btn" onClick={onRightSwipe}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
      )}

      {activeView === 'settings' ? renderSettingsDashboard() : 
       activeView === 'now-playing' ? renderNowPlaying() : 
       activeView === 'home' ? renderHomeDashboard() : (
        <>
          {activeView !== 'queue' && (
            <div className="waveform-display">
              <div className="m-waveform">
                <span className="glow-text">M</span>
                <div className="wave-bars">
                  <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                </div>
              </div>
            </div>
          )}

      <div className="header-section">
        <h2>
          {activeView === 'library' ? 'Your Library' : 
           activeView.startsWith('playlist-') ? playlists.find(p => p.id === activeView.split('-')[1])?.name :
           activeView === 'queue' ? 'Up Next Queue' :
           'Tracks'}
        </h2>
        <div className="header-left">
          <button 
            className={`select-mode-btn ${isSelectMode ? 'active' : ''}`} 
            onClick={() => { setIsSelectMode(!isSelectMode); setSelectedTracks([]); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isSelectMode ? 'var(--color-primary)' : 'transparent', color: isSelectMode ? 'var(--color-base)' : 'var(--color-text-muted)', border: '1px solid ' + (isSelectMode ? 'var(--color-primary)' : 'var(--color-border)'), padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', marginRight: '10px' }}
          >
            <CheckSquare size={14} /> Select
          </button>
          {activeView === 'queue' && queue.length > 0 && (
            <button className="clear-library-btn" onClick={() => setQueue([])}>
              <Trash2 size={16} style={{marginRight: '6px'}} /> Clear Queue
            </button>
          )}
          {activeView === 'library' && (
            <button className="clear-library-btn" onClick={handleClearLibrary} title="Clear Entire Library">
              <Trash2 size={16} />
            </button>
          )}
          <div className="divider"></div>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={18} /></button>
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><LayoutGrid size={18} /></button>
        </div>
      </div>

      <div className={`track-list ${viewMode}-view`}>
        {viewMode === 'list' && renderTrackListHeader()}
        
        {isLoading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={24} />
            <span>Loading tracks from Supabase...</span>
          </div>
        ) : displayTracks.length === 0 ? (
          <div className="empty-state">
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'}}>
              <span>{searchQuery ? "No tracks match your search." : activeView === 'queue' ? "Your queue is empty." : "No tracks found here."}</span>
              {activeView.startsWith('playlist-') && (
                <button 
                  onClick={() => setActiveView && setActiveView('library')}
                  style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary)', color: 'var(--color-base)', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer'}}
                >
                  <Plus size={16} /> Add Tracks
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul>
            {displayTracks.map((track, index) => {
              const isCurrentTrackA = currentTrackA?.id === track.id;
              const isCurrentTrackB = currentTrackB?.id === track.id;
              const isCurrentTrack = isCurrentTrackA || isCurrentTrackB;
              const isPlayingTrack = (isCurrentTrackA && isPlayingA) || (isCurrentTrackB && isPlayingB);

              return (
                <li 
                  key={`${track.id}-${index}`} 
                  className={isCurrentTrack && activeView !== 'queue' ? 'playing' : ''}
                  onClick={(e) => {
                    if (isSelectMode) {
                      toggleTrackSelection(e, track.id);
                    } else {
                      setSelectedTrackToLoad(track);
                    }
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, (event) => {
                    if (isSelectMode) {
                      toggleTrackSelection(event, track.id);
                    } else {
                      setSelectedTrackToLoad(track);
                    }
                  })}
                  style={{ cursor: 'pointer', background: selectedTracks.includes(track.id) ? 'rgba(69, 162, 158, 0.2)' : '' }}
                >
                  <div className="track-info">
                    {isSelectMode && (
                      <div style={{ marginRight: '10px', color: selectedTracks.includes(track.id) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                        {selectedTracks.includes(track.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>
                    )}
                    <div className="track-art">
                      {isCurrentTrack && viewMode === 'list' && (
                         isPlayingTrack ? (
                           <div className="playing-indicator">
                             <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                           </div>
                         ) : (
                           <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '10px' }}>
                             {isCurrentTrackA ? 'A' : 'B'}
                           </span>
                         )
                      )}
                      {isCurrentTrack && viewMode === 'grid' && (
                         <PlayCircle size={24} className="grid-playing-icon" />
                      )}
                    </div>
                    <div className="track-text">
                      <span className="grid-title">
                        {track.source === 'local' && <HardDrive size={12} style={{marginRight: '4px', verticalAlign: 'middle', color: 'var(--color-primary)'}} title="Local Offline File" />}
                        {track.title}
                      </span>
                      {viewMode === 'grid' && <span className="grid-artist">{track.artist}</span>}
                    </div>
                  </div>
                  {viewMode === 'list' && <span className="track-artist">{track.artist}</span>}
                  {viewMode === 'list' && <span className="track-dur">{track.dur}</span>}
                
                <div className="track-options-wrapper">
                  <button 
                    className="track-options-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === track.id ? null : track.id);
                      setShowAddToPlaylist(null);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  
                  {activeMenuId === track.id && (
                    <div className="track-menu-dropdown">
                      <button 
                        className="menu-item" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setQueue([track, ...queue]);
                          setActiveMenuId(null);
                        }}
                      >
                        <Play size={14} /> Play Next
                      </button>
                      <button 
                        className="menu-item" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setQueue([...queue, track]);
                          setActiveMenuId(null);
                        }}
                      >
                        <ListMusic size={14} /> Add to Queue
                      </button>
                      <button 
                        className="menu-item" 
                        onClick={(e) => { e.stopPropagation(); setShowAddToPlaylist(track.id); }}
                        onMouseEnter={() => setShowAddToPlaylist(track.id)}
                      >
                        <Plus size={14} /> Add to Playlist...
                      </button>
                      {activeView === 'queue' ? (
                        <button 
                          className="menu-item delete-item" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newQueue = [...queue];
                            newQueue.splice(index, 1);
                            setQueue(newQueue);
                            setActiveMenuId(null);
                          }}
                        >
                          <Trash2 size={14} /> Remove from Queue
                        </button>
                      ) : (
                        <button className="menu-item delete-item" onClick={(e) => handleDelete(e, track)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )}

                      {showAddToPlaylist === track.id && (
                        <div className="submenu-dropdown">
                          {playlists.length === 0 ? (
                            <div className="menu-item disabled">No playlists yet</div>
                          ) : (
                            playlists.map(p => (
                              <button key={p.id} className="menu-item" onClick={(e) => handleAddToPlaylist(e, track, p.id)}>
                                {p.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
            )}
          </div>
        </>
      )}

      {isSelectMode && selectedTracks.length > 0 && (
        <div className="multi-select-bar" style={{ position: 'sticky', bottom: '20px', left: '50%', transform: 'translateX(0)', background: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '30px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', margin: '20px auto 0', width: 'fit-content' }}>
          <span style={{ fontWeight: 'bold' }}>{selectedTracks.length} Selected</span>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveMenuId('multi-select'); setShowAddToPlaylist('multi-select'); }}
              style={{ background: 'var(--color-primary)', color: 'var(--color-base)', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add to Playlist
            </button>
            {activeMenuId === 'multi-select' && showAddToPlaylist === 'multi-select' && (
              <div className="submenu-dropdown" style={{ bottom: '100%', top: 'auto', marginBottom: '10px', right: '0' }}>
                {playlists.length === 0 ? (
                  <div className="menu-item disabled">No playlists yet</div>
                ) : (
                  playlists.map(p => (
                    <button key={p.id} className="menu-item" onClick={() => handleAddMultipleToPlaylist(p.id)}>
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button 
            onClick={() => { setIsSelectMode(false); setSelectedTracks([]); setActiveMenuId(null); setShowAddToPlaylist(null); }}
            style={{ background: 'transparent', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedTrackToLoad && (
        <div className="load-deck-modal-overlay" onClick={() => setSelectedTrackToLoad(null)}>
          <div className="load-deck-modal" onClick={(e) => e.stopPropagation()}>
            <h3>SELECT DECK</h3>
            <div className="modal-track-info">
              <span className="track-title">{selectedTrackToLoad.title}</span>
              <span className="track-artist">{selectedTrackToLoad.artist}</span>
            </div>
            <div className="modal-buttons">
              <button 
                className="deck-btn deck-a" 
                onClick={() => {
                  onPlayTrack && onPlayTrack(selectedTrackToLoad, 'A', filteredTracks);
                  setSelectedTrackToLoad(null);
                }}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  onPlayTrack && onPlayTrack(selectedTrackToLoad, 'A', filteredTracks);
                  setSelectedTrackToLoad(null);
                })}
              >
                Load to Disc A
              </button>
              <button 
                className="deck-btn deck-b" 
                onClick={() => {
                  onPlayTrack && onPlayTrack(selectedTrackToLoad, 'B', filteredTracks);
                  setSelectedTrackToLoad(null);
                }}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  onPlayTrack && onPlayTrack(selectedTrackToLoad, 'B', filteredTracks);
                  setSelectedTrackToLoad(null);
                })}
              >
                Load to Disc B
              </button>
            </div>
            <button 
              className="cancel-btn" 
              onClick={() => setSelectedTrackToLoad(null)}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, () => setSelectedTrackToLoad(null))}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
