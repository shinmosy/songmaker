import { createClient } from "@/lib/supabase/client";
import { Track } from "@/types/track";

const supabase = createClient();

// Tracks
export async function getTracks(userId: string): Promise<Track[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTrack(userId: string, track: Omit<Track, "id" | "created_at" | "updated_at">) {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("tracks")
    .insert([{ ...track, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrack(trackId: string, updates: Partial<Track>) {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("tracks")
    .update(updates)
    .eq("id", trackId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrack(trackId: string) {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("tracks")
    .delete()
    .eq("id", trackId);

  if (error) throw error;
}

// API Keys
export async function getApiKey(userId: string, provider: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("api_keys")
    .select("key_encrypted")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data?.key_encrypted || null;
}

export async function saveApiKey(userId: string, provider: string, keyEncrypted: string) {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("api_keys")
    .upsert([{ user_id: userId, provider, key_encrypted: keyEncrypted }]);

  if (error) throw error;
}

// Generation Count
export async function getGenerationCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("generation_counts")
    .select("count, reset_at")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  if (!data) {
    // Create new record
    await supabase
      .from("generation_counts")
      .insert([{ user_id: userId, count: 0 }]);
    return 0;
  }

  // Check if reset needed
  if (new Date(data.reset_at) < new Date()) {
    await supabase
      .from("generation_counts")
      .update({ count: 0, reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .eq("user_id", userId);
    return 0;
  }

  return data.count;
}

export async function incrementGenerationCount(userId: string) {
  if (!supabase) throw new Error("Supabase not initialized");
  const currentCount = await getGenerationCount(userId);
  const { error } = await supabase
    .from("generation_counts")
    .update({ count: currentCount + 1 })
    .eq("user_id", userId);

  if (error) throw error;
}
