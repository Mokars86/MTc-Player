import { set, get, del, keys } from 'idb-keyval';

export const localAudioService = {
  /**
   * Fetches a list of all local audio files stored in IndexedDB.
   */
  async fetchTracks() {
    try {
      const allKeys = await keys();
      const localKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('local_audio_'));
      
      const tracks = [];
      for (const key of localKeys) {
        const file = await get(key);
        if (file) {
          tracks.push({
            id: key,
            name: file.name,
            file: file, // Keep the File object to generate ObjectURL later
            source: 'local' // Flag to identify local tracks
          });
        }
      }
      return tracks;
    } catch (error) {
      console.error('Error fetching local tracks:', error);
      return [];
    }
  },

  /**
   * Saves local files to IndexedDB.
   * @param {FileList|File[]} files 
   */
  async uploadTracks(files) {
    let successCount = 0;
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        try {
          const id = `local_audio_${Date.now()}_${file.name}`;
          await set(id, file);
          successCount++;
        } catch (error) {
          console.error(`Failed to save ${file.name} locally:`, error);
        }
      }
    }
    return successCount;
  },

  /**
   * Deletes a local track from IndexedDB.
   * @param {string} id The IndexedDB key
   */
  async deleteTrack(id) {
    try {
      await del(id);
      return true;
    } catch (error) {
      console.error('Local Delete Error:', error);
      throw error;
    }
  },
  
  /**
   * Generates an Object URL for the local file Blob.
   * @param {File} file 
   * @returns {string} Object URL
   */
  getTrackUrl(file) {
    if (!file) return '';
    return URL.createObjectURL(file);
  }
};
