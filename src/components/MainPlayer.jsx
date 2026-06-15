import { useState, useEffect, useRef } from 'react';
import { LayoutGrid, List, Loader2, Disc3, PlayCircle, Trash2, AlertTriangle, MoreVertical, Plus, ChevronLeft, SlidersHorizontal, ListMusic, Clock, Play, HardDrive, CheckSquare, Square } from 'lucide-react';
import { audioService } from '../services/audioService';
import { localAudioService } from '../services/localAudioService';
import './MainPlayer.css';

export default function MainPlayer({ onLeftSwipe, onRightSwipe, isMobile, refreshTrigger, activeView, currentTrack, onPlayTrack, isPlaying, theme, setTheme, onLibraryClear, searchQuery, queue, setQueue, sleepTimer, setSleepTimer, analyserNodeRef, progress, duration, setActiveView }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(null); // track id whose submenu is open
  const [visualizerType, setVisualizerType] = useState('bars'); // 'bars', 'waveform', 'circle', 'disc'
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const canvasRef = useRef(null);

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

  const handleAddToPlaylist = (e, track, playlistId) => {
    e.stopPropagation();
    const playlists = JSON.parse(localStorage.getItem('mtc_playlists') || '[]');
    const targetPlaylist = playlists.find(p => p.id === playlistId);
    if (targetPlaylist) {
      if (!targetPlaylist.tracks) targetPlaylist.tracks = [];
      if (!targetPlaylist.tracks.includes(track.fileName)) {
        targetPlaylist.tracks.push(track.fileName);
        localStorage.setItem('mtc_playlists', JSON.stringify(playlists));
        alert(`Added ${track.title} to ${targetPlaylist.name}`);
      } else {
        alert("Track is already in this playlist.");
      }
    }
    setActiveMenuId(null);
    setShowAddToPlaylist(null);
  };

  const handleAddMultipleToPlaylist = (playlistId) => {
    const playlists = JSON.parse(localStorage.getItem('mtc_playlists') || '[]');
    const targetPlaylist = playlists.find(p => p.id === playlistId);
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
      localStorage.setItem('mtc_playlists', JSON.stringify(playlists));
      alert(`Added ${addedCount} tracks to ${targetPlaylist.name}`);
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
      const playlists = JSON.parse(localStorage.getItem('mtc_playlists') || '[]');
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
            <div key={track.id} className="track-card" onClick={() => onPlayTrack && onPlayTrack(track)}>
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
          {JSON.parse(localStorage.getItem('mtc_playlists') || '[]').map(p => (
             <div key={p.id} className="track-card playlist-card" onClick={() => setActiveView && setActiveView(`playlist-${p.id}`)}>
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
    const dashOffset = duration > 0 ? circumference - (progress / duration) * circumference : circumference;

    return (
    <div className="now-playing-view">
      <div className="visualizer-container" style={{ width: '100%', height: '280px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '10px 0' }}>
        {(analyserNodeRef?.current && visualizerType !== 'disc') ? (
          <canvas ref={canvasRef} width="300" height="150" style={{ width: '100%', maxWidth: '400px', height: '100%', borderRadius: '8px' }}></canvas>
        ) : (
          <div className={`virtual-disc-container ${isPlaying ? 'spinning' : ''}`}>
            <svg viewBox="0 0 220 220" className="disc-progress-ring">
              <defs>
                <mask id="progress-mask">
                  <circle
                    stroke="white"
                    strokeWidth="10"
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset: dashOffset }}
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
                mask="url(#progress-mask)"
              />
            </svg>
            <div className="virtual-disc" style={{background: '#111'}}>
              <div className="grooves"></div>
              <div className="glass-glare"></div>
              <div className="disc-center" style={{background: 'var(--color-primary)', width: '60px', height: '60px', border: '3px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                 <div className="disc-hole" style={{zIndex: 2, width: '10px', height: '10px', background: '#000'}}></div>
                 <span style={{color: 'white', fontWeight: '900', fontSize: '8px', marginTop: '6px', letterSpacing: '0px'}}>MTc Player</span>
              </div>
            </div>
            <div className="disc-shadow"></div>
          </div>
        )}
      </div>
      
      <div className="visualizer-controls" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
         <button onClick={() => setVisualizerType('bars')} style={{ background: visualizerType === 'bars' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'bars' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Bars</button>
         <button onClick={() => setVisualizerType('waveform')} style={{ background: visualizerType === 'waveform' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'waveform' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Waveform</button>
         <button onClick={() => setVisualizerType('circle')} style={{ background: visualizerType === 'circle' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'circle' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Circle</button>
         <button onClick={() => setVisualizerType('disc')} style={{ background: visualizerType === 'disc' ? 'var(--color-primary)' : 'var(--color-surface)', color: visualizerType === 'disc' ? 'var(--color-base)' : 'var(--color-text-main)', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Disc</button>
      </div>
      
      
      <h2 className="np-title">{currentTrack ? currentTrack.title : 'No Track Selected'}</h2>
      <h3 className="np-artist">{currentTrack ? currentTrack.artist : '--'}</h3>
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
           activeView.startsWith('playlist-') ? JSON.parse(localStorage.getItem('mtc_playlists') || '[]').find(p => p.id === activeView.split('-')[1])?.name :
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
            {displayTracks.map((track, index) => (
              <li 
                key={`${track.id}-${index}`} 
                className={currentTrack?.id === track.id && activeView !== 'queue' ? 'playing' : ''}
                onClick={(e) => {
                  if (isSelectMode) {
                    toggleTrackSelection(e, track.id);
                  } else if (activeView === 'queue') {
                    onPlayTrack && onPlayTrack(track, queue);
                  } else {
                    onPlayTrack && onPlayTrack(track, filteredTracks);
                  }
                }}
                style={{ cursor: 'pointer', background: selectedTracks.includes(track.id) ? 'rgba(69, 162, 158, 0.2)' : '' }}
              >
                <div className="track-info">
                  {isSelectMode && (
                    <div style={{ marginRight: '10px', color: selectedTracks.includes(track.id) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {selectedTracks.includes(track.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>
                  )}
                  <div className="track-art">
                    {currentTrack?.id === track.id && viewMode === 'list' && (
                       <div className="playing-indicator">
                         <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                       </div>
                    )}
                    {currentTrack?.id === track.id && viewMode === 'grid' && (
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
                          {JSON.parse(localStorage.getItem('mtc_playlists') || '[]').length === 0 ? (
                            <div className="menu-item disabled">No playlists yet</div>
                          ) : (
                            JSON.parse(localStorage.getItem('mtc_playlists') || '[]').map(p => (
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
                ))}
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
                {JSON.parse(localStorage.getItem('mtc_playlists') || '[]').length === 0 ? (
                  <div className="menu-item disabled">No playlists yet</div>
                ) : (
                  JSON.parse(localStorage.getItem('mtc_playlists') || '[]').map(p => (
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
    </main>
  );
}
