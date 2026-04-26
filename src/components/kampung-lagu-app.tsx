"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MODEL_VERSION_OPTIONS,
  PROVIDER_OPTIONS,
} from "../lib/songmaker-ui.mjs";

type View = "create" | "library" | "settings";
type Mode = "Simple" | "Advanced" | "Sounds";
type TrackStatus = "mock" | "queued" | "generating" | "done" | "error";
type TrackType = "Instrumental" | "Vocal";
type VocalGender = "Male" | "Female";
type ApiProvider = "modal" | "sunoapi" | "kie";

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
  apiProvider: ApiProvider;
  apiKeys: string;
}

const STORAGE_KEYS = {
  library: "songmaker-library",
  draft: "songmaker-draft",
  settings: "songmaker-settings",
  view: "songmaker-view",
};

const TITLE_LIMIT = 120;
const DESCRIPTION_LIMIT = 1000;
const LYRICS_LIMIT = 5000;
const TAG_OPTIONS = [
  "Lo-fi",
  "Jazz",
  "Ambient",
  "Electronic",
  "Classical",
  "Pop",
  "Hip Hop",
  "R&B",
  "Rock",
  "Cinematic",
];

const defaultDraft: Draft = {
  title: "",
  description: "",
  lyrics: "",
  model: MODEL_VERSION_OPTIONS[0],
  mode: "Simple",
  type: "Instrumental",
  gender: "Male",
  tags: [],
};

export default function SongMakerApp() {
  const [view, setView] = useState<View>("create");
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [library, setLibrary] = useState<Track[]>([]);
  const [settings, setSettings] = useState<Settings>({
    defaultModel: MODEL_VERSION_OPTIONS[0],
    apiProvider: "modal",
    apiKeys: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedView = localStorage.getItem(STORAGE_KEYS.view) as View | null;
    if (savedView) setView(savedView);

    const savedDraft = localStorage.getItem(STORAGE_KEYS.draft);
    if (savedDraft) setDraft(JSON.parse(savedDraft));

    const savedLibrary = localStorage.getItem(STORAGE_KEYS.library);
    if (savedLibrary) setLibrary(JSON.parse(savedLibrary));

    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.view, view);
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  const generateTrack = useCallback(async () => {
    if (!draft.title.trim()) {
      setError("Judul lagu harus diisi");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newTrack: Track = {
        id: Date.now().toString(),
        ...draft,
        status: "generating",
        createdAt: new Date().toISOString(),
        note: "",
      };

      setLibrary((prev) => [newTrack, ...prev]);

      // Call Modal endpoint
      const response = await fetch(
        "https://shinmosy--songmaker-inference-generate-music.modal.run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: draft.description,
            title: draft.title,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to generate audio");

      const data = await response.json();
      const audioUrl = data.audio_url || data.url;

      setLibrary((prev) =>
        prev.map((t) =>
          t.id === newTrack.id
            ? { ...t, status: "done", audioUrl, note: "Generated successfully" }
            : t
        )
      );

      setDraft(defaultDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLibrary((prev) =>
        prev.map((t) =>
          t.id === draft.title
            ? { ...t, status: "error", note: error || "Unknown error" }
            : t
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [draft, error]);

  const deleteTrack = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-50 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">SongMaker</h1>
          <p className="text-sm text-gray-600">AI Music Generation</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {(["create", "library", "settings"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                view === v
                  ? "border-black text-black"
                  : "border-transparent text-gray-600 hover:text-black"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {view === "create" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Create New Track</h2>
              <p className="text-gray-600">
                Buat musik & suara AI — pilih mode, rapihin prompt, lalu generate.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Title ({draft.title.length}/{TITLE_LIMIT})
                  </label>
                  <input
                    type="text"
                    placeholder="Nama lagu..."
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        title: e.target.value.slice(0, TITLE_LIMIT),
                      })
                    }
                    className="w-full"
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-sm font-medium mb-3">Mode</label>
                  <div className="flex gap-3">
                    {(["Simple", "Advanced", "Sounds"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDraft({ ...draft, mode: m })}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          draft.mode === m
                            ? "bg-black text-white"
                            : "bg-gray-100 text-black hover:bg-gray-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium mb-3">Type</label>
                  <div className="flex gap-3">
                    {(["Instrumental", "Vocal"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft({ ...draft, type: t })}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          draft.type === t
                            ? "bg-black text-white"
                            : "bg-gray-100 text-black hover:bg-gray-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description ({draft.description.length}/{DESCRIPTION_LIMIT})
                  </label>
                  <textarea
                    placeholder="Contoh: upbeat electronic anthem, bright synth, festival drop, energetic beat..."
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        description: e.target.value.slice(0, DESCRIPTION_LIMIT),
                      })
                    }
                    rows={4}
                    className="w-full"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-3">Genre</label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const newTags = draft.tags.includes(tag)
                            ? draft.tags.filter((t) => t !== tag)
                            : [...draft.tags, tag];
                          setDraft({ ...draft, tags: newTags });
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                          draft.tags.includes(tag)
                            ? "bg-black text-white"
                            : "bg-gray-100 text-black hover:bg-gray-200"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lyrics */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Lyrics ({draft.lyrics.length}/{LYRICS_LIMIT})
                  </label>
                  <textarea
                    placeholder="Isi lirik kalau mau arah vokalnya lebih jelas..."
                    value={draft.lyrics}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lyrics: e.target.value.slice(0, LYRICS_LIMIT),
                      })
                    }
                    rows={4}
                    className="w-full"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={generateTrack}
                    disabled={isLoading}
                    className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 transition-all"
                  >
                    {isLoading ? "Generating..." : "Generate"}
                  </button>
                  <button
                    onClick={() => setDraft(defaultDraft)}
                    className="flex-1 bg-gray-100 text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold mb-4">Quick Stats</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode:</span>
                      <span className="font-medium">{draft.mode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{draft.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Genres:</span>
                      <span className="font-medium">{draft.tags.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold mb-4">Recent Generations</h3>
                  <div className="space-y-2 text-sm">
                    {library.slice(0, 5).map((track) => (
                      <div
                        key={track.id}
                        className="p-2 bg-white rounded border border-gray-200 truncate"
                      >
                        {track.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "library" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Library</h2>
              <p className="text-gray-600">
                {library.length} track{library.length !== 1 ? "s" : ""} saved
              </p>
            </div>

            {library.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No tracks yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {library.map((track) => (
                  <div
                    key={track.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <h3 className="font-bold text-lg mb-2">{track.title}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {track.description}
                    </p>
                    <div className="flex gap-2 mb-4">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {track.mode}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {track.type}
                      </span>
                    </div>
                    {track.audioUrl && (
                      <audio
                        controls
                        src={track.audioUrl}
                        className="w-full mb-4"
                      />
                    )}
                    <button
                      onClick={() => deleteTrack(track.id)}
                      className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "settings" && (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="text-2xl font-bold mb-2">Settings</h2>
              <p className="text-gray-600">Configure your SongMaker preferences</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Default Model
                </label>
                <select
                  value={settings.defaultModel}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultModel: e.target.value })
                  }
                  className="w-full"
                >
                  {MODEL_VERSION_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  API Provider
                </label>
                <select
                  value={settings.apiProvider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      apiProvider: e.target.value as ApiProvider,
                    })
                  }
                  className="w-full"
                >
                  {PROVIDER_OPTIONS.map((p, idx) => (
                    <option key={idx} value={typeof p === 'string' ? p : p.value || ''}>
                      {typeof p === 'string' ? p : p.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  API Keys
                </label>
                <textarea
                  value={settings.apiKeys}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKeys: e.target.value })
                  }
                  placeholder="Paste your API keys here (keep private)"
                  rows={4}
                  className="w-full"
                />
              </div>

              <button className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-all">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
