import { useState, useEffect, useRef } from 'react';
import SplashScreen from './components/SplashScreen';
import Sidebar from './components/Sidebar';
import MainPlayer from './components/MainPlayer';
import StemMixer from './components/StemMixer';
import DockedPlayer from './components/DockedPlayer';
import { audioService } from './services/audioService';
import { localAudioService } from './services/localAudioService';
import { StatusBar } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobilePane, setActiveMobilePane] = useState(1); // 0: Library, 1: Main, 2: Mixer
  const [activeView, setActiveView] = useState('home'); // home, library, mixer, playlist-{id}
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [audioSrc, setAudioSrc] = useState('');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Audio State
  const audioRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  
  // Advanced Playback
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
  const [isShuffle, setIsShuffle] = useState(false);
  
  // Web Audio Context State
  const [eqBands, setEqBands] = useState({ bass: 50, mid: 50, treble: 50 });
  const audioContextRef = useRef(null);
  const bassNodeRef = useRef(null);
  const midNodeRef = useRef(null);
  const trebleNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const audioInitialized = useRef(false);

  const initAudioContext = () => {
    if (!audioRef.current || audioInitialized.current) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaElementSource(audioRef.current);

      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 250;
      
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1;

      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 4000;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserNodeRef.current = analyser;

      bassNodeRef.current = bass;
      midNodeRef.current = mid;
      trebleNodeRef.current = treble;

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(analyser);
      analyser.connect(ctx.destination);

      audioInitialized.current = true;
    } catch (e) {
      console.error("Audio routing error:", e);
    }
  };

  useEffect(() => {
    if (!audioInitialized.current) return;
    const mapToDB = (val) => ((val - 50) / 50) * 15; // -15 to +15 dB
    if (bassNodeRef.current) bassNodeRef.current.gain.value = mapToDB(eqBands.bass);
    if (midNodeRef.current) midNodeRef.current.gain.value = mapToDB(eqBands.mid);
    if (trebleNodeRef.current) trebleNodeRef.current.gain.value = mapToDB(eqBands.treble);
  }, [eqBands]);
  
  // Theme
  const [theme, setTheme] = useState(localStorage.getItem('mtc_theme') || 'theme-luminous-teal');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Queue & Playlist
  const [tracksList, setTracksList] = useState([]);
  const [queue, setQueue] = useState([]);

  // Sleep Timer
  const [sleepTimer, setSleepTimer] = useState(null); // Timestamp in ms

  useEffect(() => {
    if (!sleepTimer) {
      if (audioRef.current) audioRef.current.volume = volume / 100;
      return;
    }
    
    const interval = setInterval(() => {
      const remaining = sleepTimer - Date.now();
      if (remaining <= 0) {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        setSleepTimer(null);
      } else if (remaining <= 30000 && audioRef.current) {
        // Fade out over last 30 seconds
        const fadeRatio = remaining / 30000;
        audioRef.current.volume = (volume / 100) * fadeRatio;
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sleepTimer, volume, setIsPlaying]);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('mtc_theme', theme);

    // Dynamic OS Status Bar Color Sync
    const themeColors = {
      'theme-luminous-teal': '#0B0C10',
      'theme-neon-purple': '#0F0C20',
      'theme-crimson-red': '#100B0C',
      'theme-vlc-orange': '#121212',
      'theme-classic-red': '#100505',
      'theme-day-mode': '#F5F7FA'
    };
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && themeColors[theme]) {
      metaThemeColor.setAttribute('content', themeColors[theme]);
    }
    
    // Capacitor Status Bar
    try {
      if (themeColors[theme]) {
        StatusBar.setBackgroundColor({ color: themeColors[theme] });
      }
    } catch (e) {
      // Ignore if not running in Capacitor environment
    }
  }, [theme]);

  // History API and Hardware Back Button
  useEffect(() => {
    window.history.pushState({ view: activeView }, '', `#${activeView}`);
  }, [activeView]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.view) {
        setActiveView(e.state.view);
      } else {
        setActiveView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    let backListener = null;
    const setupBackBtn = async () => {
      try {
        backListener = await CapApp.addListener('backButton', () => {
          if (activeView !== 'home') {
             window.history.back();
          } else {
             CapApp.exitApp();
          }
        });
      } catch (e) {
        // Ignore if not in Capacitor
      }
    };
    setupBackBtn();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (backListener) backListener.remove();
    };
  }, [activeView]);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Audio Handlers
  const togglePlay = () => {
    if (!currentTrack || !audioRef.current) return;
    initAudioContext();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle dynamic local URLs
  useEffect(() => {
    if (!currentTrack) {
      setAudioSrc('');
      return;
    }
    if (currentTrack.source === 'local') {
      const url = localAudioService.getTrackUrl(currentTrack.file);
      setAudioSrc(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioSrc(audioService.getTrackUrl(currentTrack.fileName));
    }
  }, [currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const playTrack = (track, list = null) => {
    initAudioContext();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setCurrentTrack(track);
    setIsPlaying(true);
    if (list) setTracksList(list);
  };

  const playNext = () => {
    if (!currentTrack) return;

    if (queue.length > 0) {
      const nextTrack = queue[0];
      setQueue(queue.slice(1));
      playTrack(nextTrack);
      return;
    }

    if (tracksList.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * tracksList.length);
    } else {
      const currentIndex = tracksList.findIndex(t => t.id === currentTrack.id);
      nextIndex = currentIndex + 1;
      
      if (nextIndex >= tracksList.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else { setIsPlaying(false); return; } // end of queue
      }
    }
    playTrack(tracksList[nextIndex]);
  };

  const playPrev = () => {
    if (!currentTrack || tracksList.length === 0) return;
    if (progress > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = tracksList.findIndex(t => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = tracksList.length - 1;
    playTrack(tracksList[prevIndex]);
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

  // Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'MTc User',
        album: 'MTc Player',
        artwork: [
          { src: '/mtc-logo-v5.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
  }, [togglePlay, playPrev, playNext]);

  // Simple responsive check
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <audio 
        ref={audioRef}
        src={audioSrc}
        autoPlay={isPlaying}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {isMobile ? (
        <div className="mobile-app-container">
          <div className="mobile-swipe-wrapper" style={{ transform: `translateX(-${activeMobilePane * 100}vw)` }}>
            <div className="mobile-pane">
              <Sidebar 
                setActiveView={(view) => { setActiveView(view); setActiveMobilePane(1); }} 
                activeView={activeView}
                isMobile={true}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onUploadSuccess={() => setRefreshTrigger(prev => prev + 1)}
                onInstallPWA={handleInstallPWA}
                canInstallPWA={!!deferredPrompt}
              />
            </div>
            <div className="mobile-pane">
              <MainPlayer 
                onLeftSwipe={() => setActiveMobilePane(0)} 
                onRightSwipe={() => setActiveMobilePane(2)} 
                isMobile={true}
                refreshTrigger={refreshTrigger}
                activeView={activeView}
                currentTrack={currentTrack}
                onPlayTrack={playTrack}
                isPlaying={isPlaying}
                theme={theme}
                setTheme={setTheme}
                onLibraryClear={() => setRefreshTrigger(prev => prev + 1)}
                searchQuery={searchQuery}
                queue={queue}
                setQueue={setQueue}
                sleepTimer={sleepTimer}
                setSleepTimer={setSleepTimer}
                analyserNodeRef={analyserNodeRef}
                progress={progress}
                duration={duration}
                setActiveView={(view) => { setActiveView(view); setActiveMobilePane(1); }}
              />
            </div>
            <div className="mobile-pane">
              <StemMixer 
                isMobile={true} 
                masterVol={volume} 
                setMasterVol={setVolume} 
                setActiveView={(view) => { setActiveView(view); setActiveMobilePane(1); }}
                eqBands={eqBands}
                setEqBands={setEqBands}
              />
            </div>
          </div>
          <DockedPlayer 
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            progress={progress}
            duration={duration}
            onSeek={(time) => { if(audioRef.current) audioRef.current.currentTime = time; }}
            setActiveView={setActiveView}
            isShuffle={isShuffle}
            setIsShuffle={setIsShuffle}
            repeatMode={repeatMode}
            setRepeatMode={setRepeatMode}
            playNext={playNext}
            playPrev={playPrev}
            volume={volume}
            setVolume={setVolume}
          />
        </div>
      ) : (
      <div className="desktop-app-container">
        <Sidebar 
          setActiveView={setActiveView} 
          activeView={activeView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onUploadSuccess={() => setRefreshTrigger(prev => prev + 1)}
          onInstallPWA={handleInstallPWA}
          canInstallPWA={!!deferredPrompt}
        />
        <MainPlayer 
          refreshTrigger={refreshTrigger} 
          activeView={activeView} 
          currentTrack={currentTrack}
          onPlayTrack={playTrack}
          isPlaying={isPlaying}
          theme={theme}
          setTheme={setTheme}
          onLibraryClear={() => setRefreshTrigger(prev => prev + 1)}
          searchQuery={searchQuery}
          queue={queue}
          setQueue={setQueue}
          sleepTimer={sleepTimer}
          setSleepTimer={setSleepTimer}
          analyserNodeRef={analyserNodeRef}
          progress={progress}
          duration={duration}
          setActiveView={setActiveView}
        />
        <StemMixer 
          isMobile={false} 
          masterVol={volume} 
          setMasterVol={setVolume} 
          setActiveView={setActiveView}
          eqBands={eqBands}
          setEqBands={setEqBands}
        />
        <DockedPlayer 
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          progress={progress}
          duration={duration}
          onSeek={(time) => { if(audioRef.current) audioRef.current.currentTime = time; }}
          setActiveView={setActiveView}
          isShuffle={isShuffle}
          setIsShuffle={setIsShuffle}
          repeatMode={repeatMode}
          setRepeatMode={setRepeatMode}
          playNext={playNext}
          playPrev={playPrev}
          volume={volume}
          setVolume={setVolume}
        />
      </div>
      )}
    </>
  );
}

export default App;
