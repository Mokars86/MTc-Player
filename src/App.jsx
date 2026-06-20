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
import { SplashScreen as CapSplashScreen } from '@capacitor/splash-screen';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobilePane, setActiveMobilePane] = useState(1); // 0: Library, 1: Main, 2: Mixer
  const [activeView, setActiveView] = useState('home'); // home, library, mixer, playlist-{id}
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Native Splash Screen Dismissal
  useEffect(() => {
    const hideNativeSplash = async () => {
      try {
        await CapSplashScreen.hide();
      } catch (e) {
        console.warn('Capacitor SplashScreen.hide failed or not running in native app:', e);
      }
    };
    hideNativeSplash();
  }, []);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);

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

  // Dual-Deck Audio Elements State
  const audioRefA = useRef(null);
  const audioRefB = useRef(null);
  const [currentTrackA, setCurrentTrackA] = useState(null);
  const [currentTrackB, setCurrentTrackB] = useState(null);
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [volume, setVolume] = useState(75); // master volume
  const [volumeA, setVolumeA] = useState(100); // Deck A volume
  const [volumeB, setVolumeB] = useState(100); // Deck B volume
  const [crossfadeValue, setCrossfadeValue] = useState(0); // -1.0 to 1.0
  const [audioSrcA, setAudioSrcA] = useState('');
  const [audioSrcB, setAudioSrcB] = useState('');
  
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
    if (audioInitialized.current) return;
    if (!audioRefA.current || !audioRefB.current) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const sourceA = ctx.createMediaElementSource(audioRefA.current);
      const sourceB = ctx.createMediaElementSource(audioRefB.current);

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

      sourceA.connect(bass);
      sourceB.connect(bass);
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
      return;
    }
    
    const interval = setInterval(() => {
      const remaining = sleepTimer - Date.now();
      if (remaining <= 0) {
        if (audioRefA.current) {
          audioRefA.current.pause();
          setIsPlayingA(false);
        }
        if (audioRefB.current) {
          audioRefB.current.pause();
          setIsPlayingB(false);
        }
        setSleepTimer(null);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sleepTimer]);

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
        StatusBar.setBackgroundColor({ color: themeColors[theme] }).catch((err) => {
          console.warn('StatusBar.setBackgroundColor is not supported on this device/platform:', err);
        });
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

  // Sync volume with audio elements based on master volume, deck volumes, and crossfade
  useEffect(() => {
    const factorA = crossfadeValue <= 0 ? 1 : 1 - crossfadeValue;
    const factorB = crossfadeValue >= 0 ? 1 : 1 + crossfadeValue;

    if (audioRefA.current) {
      audioRefA.current.volume = (volume / 100) * (volumeA / 100) * factorA;
    }
    if (audioRefB.current) {
      audioRefB.current.volume = (volume / 100) * (volumeB / 100) * factorB;
    }
  }, [volume, volumeA, volumeB, crossfadeValue]);

  // Audio Handlers
  const togglePlay = (deck) => {
    const audioRef = deck === 'A' ? audioRefA : audioRefB;
    const isPlaying = deck === 'A' ? isPlayingA : isPlayingB;
    const setIsPlaying = deck === 'A' ? setIsPlayingA : setIsPlayingB;
    const currentTrack = deck === 'A' ? currentTrackA : currentTrackB;

    if (!currentTrack || !audioRef.current) return;
    initAudioContext();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.warn("Play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  // Handle dynamic URLs for Deck A
  useEffect(() => {
    if (!currentTrackA) {
      setAudioSrcA('');
      return;
    }
    if (currentTrackA.source === 'local') {
      const url = localAudioService.getTrackUrl(currentTrackA.file);
      setAudioSrcA(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioSrcA(audioService.getTrackUrl(currentTrackA.fileName));
    }
  }, [currentTrackA]);

  // Handle dynamic URLs for Deck B
  useEffect(() => {
    if (!currentTrackB) {
      setAudioSrcB('');
      return;
    }
    if (currentTrackB.source === 'local') {
      const url = localAudioService.getTrackUrl(currentTrackB.file);
      setAudioSrcB(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioSrcB(audioService.getTrackUrl(currentTrackB.fileName));
    }
  }, [currentTrackB]);

  const handleTimeUpdateA = () => {
    if (audioRefA.current) setProgressA(audioRefA.current.currentTime);
  };

  const handleTimeUpdateB = () => {
    if (audioRefB.current) setProgressB(audioRefB.current.currentTime);
  };

  const handleLoadedMetadataA = () => {
    if (audioRefA.current) setDurationA(audioRefA.current.duration);
  };

  const handleLoadedMetadataB = () => {
    if (audioRefB.current) setDurationB(audioRefB.current.duration);
  };

  const playTrack = (track, deck, list = null) => {
    initAudioContext();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    if (deck === 'A') {
      setCurrentTrackA(track);
      setIsPlayingA(true);
      if (audioRefA.current) {
        setTimeout(() => {
          audioRefA.current.play().catch(e => console.warn("A play interrupted:", e));
        }, 50);
      }
    } else {
      setCurrentTrackB(track);
      setIsPlayingB(true);
      if (audioRefB.current) {
        setTimeout(() => {
          audioRefB.current.play().catch(e => console.warn("B play interrupted:", e));
        }, 50);
      }
    }
    if (list) setTracksList(list);
  };

  const playNext = (deck) => {
    const currentTrack = deck === 'A' ? currentTrackA : currentTrackB;
    if (!currentTrack) return;

    if (queue.length > 0) {
      const nextTrack = queue[0];
      setQueue(queue.slice(1));
      playTrack(nextTrack, deck);
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
        else {
          if (deck === 'A') setIsPlayingA(false); else setIsPlayingB(false);
          return;
        } // end of queue
      }
    }
    playTrack(tracksList[nextIndex], deck);
  };

  const playPrev = (deck) => {
    const currentTrack = deck === 'A' ? currentTrackA : currentTrackB;
    const progress = deck === 'A' ? progressA : progressB;
    const audioRef = deck === 'A' ? audioRefA : audioRefB;

    if (!currentTrack || tracksList.length === 0) return;
    if (progress > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = tracksList.findIndex(t => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = tracksList.length - 1;
    playTrack(tracksList[prevIndex], deck);
  };

  const handleEndedA = () => {
    if (repeatMode === 'one') {
      if (audioRefA.current) {
        audioRefA.current.currentTime = 0;
        audioRefA.current.play().catch(e => console.warn("Replay A failed:", e));
      }
    } else {
      playNext('A');
    }
  };

  const handleEndedB = () => {
    if (repeatMode === 'one') {
      if (audioRefB.current) {
        audioRefB.current.currentTime = 0;
        audioRefB.current.play().catch(e => console.warn("Replay B failed:", e));
      }
    } else {
      playNext('B');
    }
  };

  // Media Session API
  useEffect(() => {
    const activeTrack = crossfadeValue <= 0 ? currentTrackA : currentTrackB;
    if ('mediaSession' in navigator && activeTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeTrack.title,
        artist: activeTrack.artist || 'MTc User',
        album: 'MTc Player',
        artwork: [
          { src: '/mtc-logo-v5.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, [currentTrackA, currentTrackB, crossfadeValue]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      const activeDeck = crossfadeValue <= 0 ? 'A' : 'B';
      navigator.mediaSession.setActionHandler('play', () => togglePlay(activeDeck));
      navigator.mediaSession.setActionHandler('pause', () => togglePlay(activeDeck));
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrev(activeDeck));
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext(activeDeck));
    }
  }, [crossfadeValue, currentTrackA, currentTrackB, isPlayingA, isPlayingB]);

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
        ref={audioRefA}
        src={audioSrcA}
        autoPlay={isPlayingA}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdateA}
        onLoadedMetadata={handleLoadedMetadataA}
        onEnded={handleEndedA}
      />
      <audio 
        ref={audioRefB}
        src={audioSrcB}
        autoPlay={isPlayingB}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdateB}
        onLoadedMetadata={handleLoadedMetadataB}
        onEnded={handleEndedB}
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
                
                currentTrackA={currentTrackA}
                isPlayingA={isPlayingA}
                progressA={progressA}
                durationA={durationA}
                volumeA={volumeA}
                setVolumeA={setVolumeA}
                togglePlayA={() => togglePlay('A')}
                seekA={(time) => { if (audioRefA.current) audioRefA.current.currentTime = time; }}
                
                currentTrackB={currentTrackB}
                isPlayingB={isPlayingB}
                progressB={progressB}
                durationB={durationB}
                volumeB={volumeB}
                setVolumeB={setVolumeB}
                togglePlayB={() => togglePlay('B')}
                seekB={(time) => { if (audioRefB.current) audioRefB.current.currentTime = time; }}
                
                crossfadeValue={crossfadeValue}
                setCrossfadeValue={setCrossfadeValue}
                onPlayTrack={(track, deck, list) => playTrack(track, deck, list)}
                
                theme={theme}
                setTheme={setTheme}
                onLibraryClear={() => setRefreshTrigger(prev => prev + 1)}
                searchQuery={searchQuery}
                queue={queue}
                setQueue={setQueue}
                sleepTimer={sleepTimer}
                setSleepTimer={setSleepTimer}
                analyserNodeRef={analyserNodeRef}
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
            currentTrackA={currentTrackA}
            isPlayingA={isPlayingA}
            togglePlayA={() => togglePlay('A')}
            progressA={progressA}
            durationA={durationA}
            onSeekA={(time) => { if(audioRefA.current) audioRefA.current.currentTime = time; }}
            
            currentTrackB={currentTrackB}
            isPlayingB={isPlayingB}
            togglePlayB={() => togglePlay('B')}
            progressB={progressB}
            durationB={durationB}
            onSeekB={(time) => { if(audioRefB.current) audioRefB.current.currentTime = time; }}

            crossfadeValue={crossfadeValue}
            setCrossfadeValue={setCrossfadeValue}
            
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
          
          currentTrackA={currentTrackA}
          isPlayingA={isPlayingA}
          progressA={progressA}
          durationA={durationA}
          volumeA={volumeA}
          setVolumeA={setVolumeA}
          togglePlayA={() => togglePlay('A')}
          seekA={(time) => { if (audioRefA.current) audioRefA.current.currentTime = time; }}
          
          currentTrackB={currentTrackB}
          isPlayingB={isPlayingB}
          progressB={progressB}
          durationB={durationB}
          volumeB={volumeB}
          setVolumeB={setVolumeB}
          togglePlayB={() => togglePlay('B')}
          seekB={(time) => { if (audioRefB.current) audioRefB.current.currentTime = time; }}
          
          crossfadeValue={crossfadeValue}
          setCrossfadeValue={setCrossfadeValue}
          onPlayTrack={(track, deck, list) => playTrack(track, deck, list)}
          
          theme={theme}
          setTheme={setTheme}
          onLibraryClear={() => setRefreshTrigger(prev => prev + 1)}
          searchQuery={searchQuery}
          queue={queue}
          setQueue={setQueue}
          sleepTimer={sleepTimer}
          setSleepTimer={setSleepTimer}
          analyserNodeRef={analyserNodeRef}
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
          currentTrackA={currentTrackA}
          isPlayingA={isPlayingA}
          togglePlayA={() => togglePlay('A')}
          progressA={progressA}
          durationA={durationA}
          onSeekA={(time) => { if(audioRefA.current) audioRefA.current.currentTime = time; }}
          
          currentTrackB={currentTrackB}
          isPlayingB={isPlayingB}
          togglePlayB={() => togglePlay('B')}
          progressB={progressB}
          durationB={durationB}
          onSeekB={(time) => { if(audioRefB.current) audioRefB.current.currentTime = time; }}

          crossfadeValue={crossfadeValue}
          setCrossfadeValue={setCrossfadeValue}
          
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
