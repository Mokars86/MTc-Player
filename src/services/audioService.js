import { supabase } from '../supabaseClient';

const BUCKET_NAME = 'MTc Player';

export const audioService = {
  /**
   * Fetches a list of all audio files in the MTc Player storage bucket.
   * Note: This will only work if the bucket is public or the user is authenticated with proper RLS policies.
   */
  async fetchTracks() {
    try {
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching tracks from Supabase:', error.message);
      return [];
    }
  },

  /**
   * Generates a public URL for a specific file in the MTc Player bucket.
   * @param {string} fileName 
   */
  getTrackUrl(fileName) {
    const { data } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
      
    return data.publicUrl;
  },

  /**
   * Uploads a file to the MTc Player bucket.
   * @param {File} file 
   */
  async uploadTrack(file) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(file.name, file, { cacheControl: '3600', upsert: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  },

  async deleteTrack(fileName) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete Error:', error);
      throw error;
    }
  },

  async clearLibrary() {
    try {
      const tracks = await this.fetchTracks();
      const fileNames = tracks.map(t => t.name);
      if (fileNames.length > 0) {
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(fileNames);
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Clear Library Error:', error);
      throw error;
    }
  }
};
