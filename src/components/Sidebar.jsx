import { useState, useRef, useEffect } from 'react';
import { Home, Library, SlidersHorizontal, Plus, Music, Search, Loader2, UploadCloud, Settings, FolderPlus, Download } from 'lucide-react';
import { audioService } from '../services/audioService';
import { localAudioService } from '../services/localAudioService';
import './Sidebar.css';

export default function Sidebar({ onNavigate, onUploadSuccess, activeView, setActiveView, searchQuery, setSearchQuery, onInstallPWA, canInstallPWA }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const fileInputRef = useRef(null);
  const localFileInputRef = useRef(null);

  // Load playlists from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mtc_playlists');
    if (saved) {
      setPlaylists(JSON.parse(saved));
    }
  }, []);

  // Drag and drop handlers (mocked for now)
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const processFiles = async (files) => {
    setIsUploading(true);
    let successCount = 0;

    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        try {
          await audioService.uploadTrack(file);
          successCount++;
        } catch (error) {
          alert(`Failed to upload ${file.name}.`);
        }
      } else {
        alert(`${file.name} is not a valid audio file.`);
      }
    }

    setIsUploading(false);
    if (successCount > 0 && onUploadSuccess) {
      onUploadSuccess();
    }
  };

  const handleLocalFileInput = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true); // Re-use uploading state for simplicity or create a new saving state
      const count = await localAudioService.uploadTracks(e.target.files);
      setIsUploading(false);
      if (count > 0 && onUploadSuccess) {
         onUploadSuccess();
      }
    }
  };

  const submitPlaylist = (e) => {
    e.preventDefault();
    if (newPlaylistName.trim() !== "") {
      const newPlaylist = { id: Date.now().toString(), name: newPlaylistName.trim() };
      const updated = [...playlists, newPlaylist];
      setPlaylists(updated);
      localStorage.setItem('mtc_playlists', JSON.stringify(updated));
    }
    setIsCreatingPlaylist(false);
    setNewPlaylistName('');
  };

  const navTo = (view) => {
    if (setActiveView) setActiveView(view);
    if (onNavigate) onNavigate(view);
  };

  return (
    <aside 
      className={`sidebar-container ${isDragging ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        multiple 
        accept="audio/*" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileInput} 
      />
      <input 
        type="file" 
        multiple 
        accept="audio/*" 
        ref={localFileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleLocalFileInput} 
      />

      {isDragging && !isUploading && (
        <div className="drag-overlay clickable-overlay" onClick={() => fileInputRef.current?.click()}>
          <span>Drop tracks or Click to Browse</span>
        </div>
      )}
      {isUploading && (
        <div className="drag-overlay uploading-overlay">
          <Loader2 className="spinner" size={32} />
          <span>Uploading to Supabase...</span>
        </div>
      )}

      <div className="sidebar-search">
        <Search size={16} />
        <input 
          type="text" 
          placeholder="Search tracks..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="sidebar-nav">
        <ul>
          <li className={activeView === 'home' ? 'active' : ''} onClick={() => navTo('home')}>
            <Home size={18} /> Home
          </li>
          <li className={activeView === 'library' ? 'active' : ''} onClick={() => navTo('library')}>
            <Library size={18} /> Library
          </li>
          <li className={activeView === 'mixer' ? 'active' : ''} onClick={() => navTo('mixer')}>
            <SlidersHorizontal size={18} /> Stem Mixer
          </li>
        </ul>
        <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud size={18} /> Upload Online
        </button>
        <button className="upload-btn local-btn" onClick={() => localFileInputRef.current?.click()} style={{ marginTop: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <FolderPlus size={18} /> Add Local Music
        </button>
        {canInstallPWA && (
          <button className="upload-btn" onClick={onInstallPWA} style={{ marginTop: '10px', background: 'var(--color-primary)', border: '1px solid var(--color-primary)', color: '#000', fontWeight: 'bold' }}>
            <Download size={18} /> Install Desktop App
          </button>
        )}
      </div>

      <div className="sidebar-playlists">
        <div className="playlists-header">
          <span>PLAYLISTS</span>
          <button className="add-btn" onClick={() => setIsCreatingPlaylist(true)} title="Create Playlist">
            <Plus size={16} />
          </button>
        </div>
        <ul>
          {isCreatingPlaylist && (
            <li className="playlist-input-container">
              <form onSubmit={submitPlaylist}>
                <input 
                  type="text" 
                  autoFocus 
                  placeholder="Playlist name..." 
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onBlur={() => { setIsCreatingPlaylist(false); setNewPlaylistName(''); }}
                />
              </form>
            </li>
          )}
          {playlists.length === 0 && !isCreatingPlaylist ? (
            <li style={{ color: 'var(--color-surface)' }}>No playlists yet</li>
          ) : (
            playlists.map(p => (
              <li 
                key={p.id} 
                className={activeView === `playlist-${p.id}` ? 'active' : ''}
                onClick={() => navTo(`playlist-${p.id}`)}
              >
                <Music size={14} /> {p.name}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <ul>
          <li className={activeView === 'settings' ? 'active' : ''} onClick={() => navTo('settings')}>
            <Settings size={18} /> Settings
          </li>
        </ul>
      </div>
    </aside>
  );
}
