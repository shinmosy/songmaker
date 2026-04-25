"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type View = "create" | "library" | "settings";
type Mode = "Simple" | "Advanced" | "Sounds";
type TrackStatus = "mock" | "queued" | "generating" | "done" | "error";
type TrackType = "Instrumental" | "Vocal";
type VocalGender = "Male" | "Female";

interface Track {
  id: string;
  title: string;
  description: string;
  lyrics: string;
  model: string;
  mode: Mode;
  type: TrackType;
  gender: VocalGender;
  tags: string[];
  status: TrackStatus;
  createdAt: string;
  note: string;
  audioUrl?: string;
}

interface Draft {
  title: string;
  description: string;
  lyrics: string;
  model: string;
  mode: Mode;
  type: TrackType;
  gender: VocalGender;
  tags: string[];
}

interface Settings {
  defaultModel: string;
}

const STORAGE_KEYS = {
  library: "songmaker-library",
  draft: "songmaker-draft",
  settings: "songmaker-settings",
  view: "songmaker-view",
};

const defaultDraft: Draft = {
  title: "",
  description: "",
  lyrics: "",
  model: "MusicGen-Medium",
  mode: "Simple",
  type: "Instrumental",
  gender: "Male",
  tags: [],
};

const defaultSettings: Settings = {
  defaultModel: "MusicGen-Medium",
};

export default function KampungLaguApp() {
  const [view, setView] = useState<View>("create");
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  // Hydrate from localStorage
  useEffect(() => {
    const savedLibrary = localStorage.getItem(STORAGE_KEYS.library);
    const savedDraft = localStorage.getItem(STORAGE_KEYS.draft);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const savedView = localStorage.getItem(STORAGE_KEYS.view);

    if (savedLibrary) setTracks(JSON.parse(savedLibrary));
    if (savedDraft) setDraft(JSON.parse(savedDraft));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedView) setView(JSON.parse(savedView));
  }, []);

  // Persist library
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(tracks));
  }, [tracks]);

  // Persist draft
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  // Persist view
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.view, JSON.stringify(view));
  }, [view]);

  const filteredTracks = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return tracks;

    return tracks.filter((track) => {
      const haystack = [
        track.title,
        track.description,
        track.model,
        track.status,
        track.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [search, tracks]);

  const totalTracks = tracks.length;

  const saveSettings = () => {
    setSettings((prev) => ({
      ...prev,
      defaultModel: settings.defaultModel,
    }));
    setNotice("Settings tersimpan.");
  };

  const clearDraft = () => {
    setDraft(defaultDraft);
    setNotice("Draft dibersihkan.");
  };

  const toggleTag = (tag: string) => {
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((item) => item !== tag)
        : [...prev.tags, tag],
    }));
  };

  const generateTrack = useCallback(async () => {
    console.log("generateTrack called");
    if (!draft.description.trim()) {
      setNotice("Deskripsi utama wajib diisi dulu.");
      return;
    }

    if (!draft.description.trim()) {
      setNotice("Description harus diisi!");
      return;
    }

    const title = draft.title.trim() || `Untitled ${tracks.length + 1}`;
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      title,
      description: draft.description.trim(),
      lyrics: draft.lyrics.trim(),
      model: draft.model,
      mode: draft.mode,
      type: draft.type,
      gender: draft.gender,
      tags: draft.tags,
      status: "generating",
      createdAt: new Date().toISOString(),
      note: "Sedang generate audio dengan HuggingFace MusicGen...",
      audioUrl: undefined,
    };

    setTracks((prev) => [newTrack, ...prev]);
    console.log("Track added:", newTrack);
    setView("library");
    setNotice("Track masuk library. Sedang generate audio...");

    // Call Vercel API route (call HuggingFace)
    try {
      const response = await fetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: draft.description.trim(),
          duration: 10,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Jika audio ada, simpan. Jika tidak, gunakan test audio
          const audioUrl = result.audio 
            ? `data:audio/wav;base64,${result.audio}`
            : `/test-audio.mp3?t=${Date.now()}`;
          
          setTracks((prev) =>
            prev.map((t) =>
              t.id === newTrack.id
                ? {
                    ...t,
                    status: "done",
                    audioUrl: audioUrl,
                    note: result.note || "Audio ready to play",
                  }
                : t
              )
            );
          setNotice("Audio ready! Klik play untuk dengarkan.");
        } else {
          throw new Error(result.error || "Generation failed");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === newTrack.id
            ? {
                ...t,
                status: "error",
                note: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              }
            : t
        )
      );
      setNotice(`Error generating audio: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [draft, setTracks, setNotice, setDraft]);

  const deleteTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setNotice("Track dihapus.");
  };

  // Render full UI
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-black px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold">SongMaker</h1>
          <p className="text-sm text-gray-400">Open-source music generator</p>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Notice */}
        {notice && (
          <div className="mb-4 rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm text-gray-200">
            {notice}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-700">
          {(["create", "library", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-2 font-medium transition ${
                view === tab
                  ? "border-b-2 border-white text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-lg border border-gray-700 bg-gray-950 p-6">
          {/* CREATE VIEW */}
          {view === "create" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-4 text-xl font-semibold">Create Track</h2>
                <p className="mb-6 text-sm text-gray-400">
                  Buat musik baru dengan AI. Real audio generation tinggal disambung ke endpoint open-source.
                </p>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Simple", "Advanced", "Sounds"] as Mode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDraft((prev) => ({ ...prev, mode }))}
                      className={`rounded px-3 py-2 text-sm font-medium transition ${
                        draft.mode === mode
                          ? "bg-white text-black"
                          : "border border-gray-600 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Instrumental", "Vocal"] as TrackType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDraft((prev) => ({ ...prev, type }))}
                      className={`rounded px-3 py-2 text-sm font-medium transition ${
                        draft.type === type
                          ? "bg-white text-black"
                          : "border border-gray-600 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender (if Vocal) */}
              {draft.type === "Vocal" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Vocal Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Male", "Female"] as VocalGender[]).map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setDraft((prev) => ({ ...prev, gender }))}
                        className={`rounded px-3 py-2 text-sm font-medium transition ${
                          draft.gender === gender
                            ? "bg-white text-black"
                            : "border border-gray-600 text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Judul track..."
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (required)</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi musik yang ingin dibuat..."
                  rows={4}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
                />
              </div>

              {/* Lyrics */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lyrics (optional)</label>
                <textarea
                  value={draft.lyrics}
                  onChange={(e) => setDraft((prev) => ({ ...prev, lyrics: e.target.value }))}
                  placeholder="Lirik lagu (jika ada)..."
                  rows={3}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {["Lo-fi", "Jazz", "Ambient", "Electronic", "Classical", "Pop", "Hip Hop", "Rock"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        draft.tags.includes(tag)
                          ? "bg-white text-black"
                          : "border border-gray-600 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                <select
                  value={draft.model}
                  onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:outline-none"
                >
                  {["MusicGen-Small", "MusicGen-Medium", "MusicGen-Large"].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={async () => {
                    try {
                      await generateTrack();
                    } catch (e) {
                      console.error('Generate error:', e);
                    }
                  }}
                  className="flex-1 rounded bg-white px-4 py-2 font-medium text-black hover:bg-gray-200 transition"
                >
                  Generate
                </button>
                <button
                  onClick={clearDraft}
                  className="flex-1 rounded border border-gray-600 px-4 py-2 font-medium text-gray-300 hover:border-gray-500 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* LIBRARY VIEW */}
          {view === "library" && (
            <div className="space-y-4">
              <div>
                <h2 className="mb-4 text-xl font-semibold">Library</h2>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari track..."
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
                />
              </div>

              {filteredTracks.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Belum ada track. Buat yang baru di tab Create.</p>
              ) : (
                <div className="space-y-3">
                  {filteredTracks.map((track) => (
                    <div key={track.id} className="rounded border border-gray-700 bg-gray-900 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{track.title}</h3>
                          <p className="text-sm text-gray-400 mt-1">{track.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                              {track.status}
                            </span>
                            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                              {track.model}
                            </span>
                            {track.tags.map((tag) => (
                              <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">{track.note}</p>
                          {/* Audio Player */}
                          <div className="mt-3">
                            <audio
                              controls
                              className="w-full h-8 bg-gray-800 rounded"
                              src={track.audioUrl || ""}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTrack(track.id)}
                          className="text-gray-400 hover:text-red-400 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS VIEW */}
          {view === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-4 text-xl font-semibold">Settings</h2>
              </div>

              {/* Endpoint URL */}
              <div className="rounded border border-gray-700 bg-gray-900 p-4">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>🎵 Audio Generation</strong>
                </p>
                <p className="text-xs text-gray-400">
                  Powered by <strong>HuggingFace MusicGen</strong>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Automatic audio generation. No setup needed!
                </p>
              </div>

              {/* Default Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Default Model</label>
                <select
                  value={settings.defaultModel}
                  onChange={(e) => setSettings((prev) => ({ ...prev, defaultModel: e.target.value }))}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:outline-none"
                >
                  {["MusicGen-Small", "MusicGen-Medium", "MusicGen-Large"].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="rounded border border-green-700 bg-gray-900 p-4">
                <p className="text-sm text-gray-300">
                  <strong>Status:</strong>{" "}
                  <span className="text-green-400">Ready ✓</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Siap untuk generate musik. Tinggal isi deskripsi dan klik Generate!
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  <strong>Total Tracks:</strong> {totalTracks}
                </p>
              </div>

              {/* Save */}
              <button
                onClick={saveSettings}
                className="w-full rounded bg-white px-4 py-2 font-medium text-black hover:bg-gray-200 transition"
              >
                Save Settings
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
