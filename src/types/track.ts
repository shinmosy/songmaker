export interface Track {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  lyrics?: string;
  model: string;
  mode: "Simple" | "Advanced" | "Sounds";
  type: "Instrumental" | "Vocal";
  gender: "Male" | "Female";
  tags: string[];
  status: "generating" | "done" | "error";
  audio_url?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}
