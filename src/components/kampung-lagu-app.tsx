"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  boostDescription,
  countConfiguredApiKeys,
  getPlayableAudioUrl,
  getProviderConfig,
  getRecentTracks,
  getStatusMeta,
  MODEL_VERSION_OPTIONS,
  PROVIDER_OPTIONS,
} from "../lib/songmaker-ui.mjs";
import {
  getAlbumThumbnailMeta,
  getLyricsLines,
  getNextTrackId,
  getPlayableQueue,
  getPreviousTrackId,
} from "../lib/songmaker-player.mjs";

type View = "create" | "library" | "settings";
type Mode = "Simple" | "Advanced" | "Sounds";
type TrackStatus = "mock" | "queued" | "generating" | "done" | "error";
type TrackType = "Instrumental" | "Vocal";
type VocalGender = "Male" | "Female";
type ApiProvider = "modal" | "sunoapi" | "kie";
type RepeatMode = "off" | "all" | "one";
type PlayerPanel = "queue" | "lyrics";

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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
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
const PROVIDER_STATUS_POLL_ATTEMPTS = 25;
const PROVIDER_STATUS_POLL_DELAY_MS = 8000;
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

const defaultSettings: Settings = {
  defaultModel: MODEL_VERSION_OPTIONS[0],
  apiProvider: "modal",
  apiKeys: "",
};

const fieldClassName =
  "w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-3 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none";

export default function KampungLaguApp() {
  const [view, setView] = useState<View>("create");
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlayerPaused, setIsPlayerPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(0.85);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [playerPanel, setPlayerPanel] = useState<PlayerPanel>("queue");
  const [isPlayerPanelOpen, setIsPlayerPanelOpen] = useState(true);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallSupported, setIsInstallSupported] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const savedLibrary = localStorage.getItem(STORAGE_KEYS.library);
    const savedDraft = localStorage.getItem(STORAGE_KEYS.draft);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const savedView = localStorage.getItem(STORAGE_KEYS.view);

    if (savedLibrary) setTracks(JSON.parse(savedLibrary));
    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      setDraft({
        ...defaultDraft,
        ...parsedDraft,
        model: MODEL_VERSION_OPTIONS.includes(parsedDraft.model)
          ? parsedDraft.model
          : defaultDraft.model,
      });
    }
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      setSettings({
        ...defaultSettings,
        ...parsedSettings,
        defaultModel: MODEL_VERSION_OPTIONS.includes(parsedSettings.defaultModel)
          ? parsedSettings.defaultModel
          : defaultSettings.defaultModel,
        apiProvider: PROVIDER_OPTIONS.some((provider) => provider.value === parsedSettings.apiProvider)
          ? parsedSettings.apiProvider
          : defaultSettings.apiProvider,
      });
    }
    if (savedView) setView(JSON.parse(savedView));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(tracks));
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.view, JSON.stringify(view));
  }, [view]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => setServiceWorkerReady(true))
      .catch(() => setServiceWorkerReady(false));
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setIsInstallSupported(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!nowPlaying) return;

    const updatedTrack = tracks.find((track) => track.id === nowPlaying.id);
    if (!updatedTrack) {
      setNowPlaying(null);
      return;
    }

    const playableAudioUrl = getPlayableAudioUrl(updatedTrack) || updatedTrack.audioUrl || "";
    if (
      updatedTrack.title !== nowPlaying.title ||
      updatedTrack.description !== nowPlaying.description ||
      updatedTrack.note !== nowPlaying.note ||
      playableAudioUrl !== (nowPlaying.audioUrl || "") ||
      updatedTrack.lyrics !== nowPlaying.lyrics
    ) {
      setNowPlaying({ ...updatedTrack, audioUrl: playableAudioUrl });
    }
  }, [tracks, nowPlaying]);

  useEffect(() => {
    if (!nowPlaying || !audioRef.current) return;

    const player = audioRef.current;
    player.volume = playerVolume;
    player.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlayerPaused(false);
    void player.play().catch(() => {
      setIsPlayerPaused(true);
    });
  }, [nowPlaying, playerVolume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = playerVolume;
  }, [playerVolume]);

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return tracks;

    return tracks.filter((track) => {
      const haystack = [
        track.title,
        track.description,
        track.note,
        track.model,
        track.mode,
        track.type,
        track.gender,
        ...track.tags,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [search, tracks]);

  const recentTracks = useMemo(() => getRecentTracks(tracks, 5), [tracks]);
  const playableQueue = useMemo<Track[]>(() => getPlayableQueue(tracks) as Track[], [tracks]);
  const nowPlayingIndex = useMemo(
    () => playableQueue.findIndex((track) => track.id === nowPlaying?.id),
    [playableQueue, nowPlaying]
  );
  const nowPlayingLyrics = useMemo(() => getLyricsLines(nowPlaying?.lyrics || ""), [nowPlaying]);
  const nowPlayingThumbnail = useMemo(() => getAlbumThumbnailMeta(nowPlaying || {}), [nowPlaying]);
  const activeProviderConfig = useMemo(
    () => getProviderConfig(settings.apiProvider),
    [settings.apiProvider]
  );
  const configuredApiKeyCount = useMemo(
    () => countConfiguredApiKeys(settings.apiKeys),
    [settings.apiKeys]
  );
  const totalTracks = tracks.length;
  const readyTracks = tracks.filter((track) => track.status === "done").length;
  const activeGenerations = tracks.filter((track) => track.status === "generating" || track.status === "queued").length;
  const errorTracks = tracks.filter((track) => track.status === "error").length;

  const syncNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice("");
    }, 2800);
  }, []);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const copyText = async (value: string, emptyMessage: string, successMessage: string) => {
    if (!value.trim()) {
      syncNotice(emptyMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      syncNotice(successMessage);
    } catch {
      syncNotice("Clipboard tidak tersedia di browser ini.");
    }
  };

  const handleBoostDescription = () => {
    updateDraft(
      "description",
      boostDescription({
        description: draft.description,
        tags: draft.tags,
        mode: draft.mode,
        type: draft.type,
        gender: draft.gender,
      })
    );
    syncNotice("Deskripsi di-boost biar prompt lebih kaya.");
  };

  const toggleTag = (tag: string) => {
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((currentTag) => currentTag !== tag)
        : [...prev.tags, tag],
    }));
  };

  const clearDraft = () => {
    setDraft({ ...defaultDraft, model: settings.defaultModel });
    syncNotice("Draft dibersihkan.");
  };

  const refreshLibrary = () => {
    const savedLibrary = localStorage.getItem(STORAGE_KEYS.library);
    setTracks(savedLibrary ? JSON.parse(savedLibrary) : []);
    syncNotice("Library di-refresh dari browser.");
  };

  const clearAllTracks = () => {
    setTracks([]);
    setNowPlaying(null);
    syncNotice("Semua track di library dihapus.");
  };

  const deleteTrack = (id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));
    if (nowPlaying?.id === id) {
      setNowPlaying(null);
    }
    syncNotice("Track dihapus dari library.");
  };

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return "0:00";
    }

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const playTrack = useCallback((track: Track) => {
    const playableAudioUrl = getPlayableAudioUrl(track);

    if (!playableAudioUrl) {
      syncNotice("Audio track ini belum siap diputar.");
      return;
    }

    const shouldOpenPanel = typeof window !== "undefined" ? window.innerWidth >= 768 : true;

    setNowPlaying({ ...track, audioUrl: playableAudioUrl });
    setPlayerPanel(track.lyrics.trim() ? "lyrics" : "queue");
    setIsPlayerPanelOpen(shouldOpenPanel);
    syncNotice(`Sekarang memutar: ${track.title}`);
  }, [syncNotice]);

  const playTrackById = useCallback((trackId: string | null) => {
    if (!trackId) return;

    const targetTrack = playableQueue.find((track) => track.id === trackId);
    if (!targetTrack) return;

    playTrack(targetTrack);
  }, [playTrack, playableQueue]);

  const handleTogglePlayback = async () => {
    if (!audioRef.current || !nowPlaying) return;

    if (audioRef.current.paused) {
      await audioRef.current.play().catch(() => undefined);
      setIsPlayerPaused(false);
      return;
    }

    audioRef.current.pause();
    setIsPlayerPaused(true);
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value: number) => {
    setPlayerVolume(value);
  };

  const getDownloadUrl = useCallback((track: Track | null) => {
    if (!track) return "";
    return getPlayableAudioUrl(track) || track.audioUrl || "";
  }, []);

  const getDownloadFileName = useCallback((track: Track | null) => {
    const safeTitle = (track?.title || "songmaker-track").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
    return `${safeTitle || "songmaker-track"}.mp3`;
  }, []);

  const handleDownloadNotice = useCallback((track: Track | null) => {
    if (!track) {
      syncNotice("Audio track tidak tersedia untuk diunduh.");
      return;
    }

    const downloadUrl = getDownloadUrl(track);
    if (!downloadUrl) {
      syncNotice("Audio track tidak tersedia untuk diunduh.");
      return;
    }

    syncNotice(`Mengunduh: ${track.title}`);
  }, [getDownloadUrl, syncNotice]);

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  const handlePreviousTrack = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    playTrackById(getPreviousTrackId({ queue: playableQueue, currentTrackId: nowPlaying?.id || "" }));
  };

  const handleNextTrack = () => {
    const nextTrackId = getNextTrackId({
      queue: playableQueue,
      currentTrackId: nowPlaying?.id || "",
      shuffle: shuffleEnabled,
      repeatMode,
    });

    if (!nextTrackId) {
      setIsPlayerPaused(true);
      return;
    }

    playTrackById(nextTrackId);
  };

  const saveSettings = () => {
    setDraft((prev) => ({ ...prev, model: settings.defaultModel }));
    syncNotice(`Settings disimpan. ${configuredApiKeyCount} API key aktif untuk ${activeProviderConfig.label}.`);
  };

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const pollProviderTrack = async (trackId: string, taskId: string, provider: ApiProvider) => {
    for (let attempt = 0; attempt < PROVIDER_STATUS_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch("/api/generate/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKeys: settings.apiKeys,
          taskId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || `Status API error: ${response.status}`);
      }

      if (result.audioUrl) {
        setTracks((prev) =>
          prev.map((track) =>
            track.id === trackId
              ? {
                  ...track,
                  status: "done",
                  note: result.note || "Generated successfully",
                  audioUrl: result.audioUrl,
                }
              : track
          )
        );
        return;
      }

      setTracks((prev) =>
        prev.map((track) =>
          track.id === trackId
            ? {
                ...track,
                status: "queued",
                note: result.note || "Audio masih diproses provider...",
              }
            : track
        )
      );

      if (attempt < PROVIDER_STATUS_POLL_ATTEMPTS - 1) {
        await sleep(PROVIDER_STATUS_POLL_DELAY_MS);
      }
    }

    throw new Error("Provider masih proses terlalu lama. Coba cek lagi sebentar.");
  };

  useEffect(() => {
    if (!audioRef.current) return;

    const player = audioRef.current;
    const handleTimeUpdate = () => {
      setCurrentTime(player.currentTime || 0);
      if (Number.isFinite(player.duration) && player.duration > 0) {
        setDuration(player.duration);
      }
    };
    const handleLoadedMetadata = () => setDuration(player.duration || 0);
    const handleCanPlay = () => setDuration(player.duration || 0);
    const handleDurationChange = () => {
      if (Number.isFinite(player.duration) && player.duration > 0) {
        setDuration(player.duration);
      }
    };
    const handlePause = () => setIsPlayerPaused(true);
    const handlePlay = () => setIsPlayerPaused(false);
    const handleError = () => {
      setIsPlayerPaused(true);
      if (nowPlaying?.id) {
        setTracks((prev) =>
          prev.map((track) =>
            track.id === nowPlaying.id
              ? {
                  ...track,
                  note: "Audio gagal dimuat. Coba generate ulang atau pilih track lain.",
                }
              : track
          )
        );
      }
      syncNotice("Audio gagal dimuat. Coba play track lain atau generate ulang.");
    };
    const handleEnded = () => {
      const nextTrackId = getNextTrackId({
        queue: playableQueue,
        currentTrackId: nowPlaying?.id || "",
        shuffle: shuffleEnabled,
        repeatMode,
      });

      if (!nextTrackId) {
        setIsPlayerPaused(true);
        return;
      }

      playTrackById(nextTrackId);
    };

    player.addEventListener("timeupdate", handleTimeUpdate);
    player.addEventListener("loadedmetadata", handleLoadedMetadata);
    player.addEventListener("canplay", handleCanPlay);
    player.addEventListener("durationchange", handleDurationChange);
    player.addEventListener("pause", handlePause);
    player.addEventListener("play", handlePlay);
    player.addEventListener("error", handleError);
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("loadedmetadata", handleLoadedMetadata);
      player.removeEventListener("canplay", handleCanPlay);
      player.removeEventListener("durationchange", handleDurationChange);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("error", handleError);
      player.removeEventListener("ended", handleEnded);
    };
  }, [nowPlaying, playableQueue, repeatMode, shuffleEnabled, playTrackById, syncNotice]);

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      syncNotice("Install prompt belum tersedia. Coba buka pakai Chrome/Edge di HTTPS.");
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    setIsInstallSupported(false);
    syncNotice(choice.outcome === "accepted" ? "SongMaker siap di-install ✨" : "Install dibatalkan.");
  };

  const generateTrack = async () => {
    if (!draft.title.trim()) {
      syncNotice("Judul lagu wajib diisi dulu.");
      return;
    }

    if (!draft.description.trim()) {
      syncNotice("Deskripsi utama wajib diisi dulu.");
      return;
    }

    const newTrack: Track = {
      id: Date.now().toString(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      lyrics: draft.lyrics.trim(),
      model: draft.model,
      mode: draft.mode,
      type: draft.type,
      gender: draft.gender,
      tags: draft.tags,
      status: "generating",
      createdAt: new Date().toISOString(),
      note: "Sedang generate audio...",
      audioUrl: "",
    };

    setTracks((prev) => [newTrack, ...prev]);
    setIsGenerating(true);
    setGenerateProgress(10);
    syncNotice("Generate dimulai. Tunggu sebentar ya...");

    const abortController = new AbortController();
    generateAbortRef.current = abortController;

    // Set timeout 90 detik untuk generate (Modal/Suno bisa lama)
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, 90000);

    try {
      setGenerateProgress(20);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: draft.description,
          title: draft.title,
          description: draft.description,
          lyrics: draft.lyrics,
          model: draft.model,
          type: draft.type,
          tags: draft.tags,
          provider: settings.apiProvider,
          apiKeys: settings.apiKeys,
          duration: 10,
        }),
        signal: abortController.signal,
      });

      window.clearTimeout(timeoutId);

      setGenerateProgress(60);
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.success === false) {
        const errorMsg = result?.error || `API error: ${response.status}`;
        throw new Error(errorMsg);
      }

      setGenerateProgress(80);

      if (result.audioUrl || result.audio) {
        const generatedAudioUrl =
          result.audioUrl || (result.audio ? `data:audio/${result.format || "wav"};base64,${result.audio}` : "");

        if (!generatedAudioUrl) {
          throw new Error(result.error || "Audio kosong dari server");
        }

        setTracks((prev) =>
          prev.map((track) =>
            track.id === newTrack.id
              ? {
                  ...track,
                  status: "done",
                  note: result.note || "Generated successfully",
                  audioUrl: generatedAudioUrl,
                }
              : track
          )
        );
        setGenerateProgress(100);
        syncNotice(`✨ Lagu "${newTrack.title}" berhasil dibuat!`);
      } else if (result.taskId && (result.providerUsed === "sunoapi" || result.providerUsed === "kie")) {
        setTracks((prev) =>
          prev.map((track) =>
            track.id === newTrack.id
              ? {
                  ...track,
                  status: "queued",
                  note: result.note || "Task dibuat, sedang diproses provider...",
                }
              : track
          )
        );

        setGenerateProgress(50);
        syncNotice("Task dikirim ke provider. Lagi diproses ya...");
        await pollProviderTrack(newTrack.id, result.taskId, result.providerUsed);
        setGenerateProgress(100);
      } else {
        throw new Error(result.error || "Audio kosong dari server");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      let userMessage = errorMsg;
      if (errorMsg.includes("Failed to fetch")) {
        userMessage = "Koneksi error. Cek internet atau coba lagi.";
      } else if (errorMsg.includes("timeout") || errorMsg.includes("terlalu lama") || errorMsg.includes("AbortError")) {
        userMessage = "Generate terlalu lama. Coba lagi atau pilih provider lain.";
      } else if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
        userMessage = "API key tidak valid. Cek Settings.";
      } else if (errorMsg.includes("429")) {
        userMessage = "Rate limit. Tunggu sebentar terus coba lagi.";
      }

      setTracks((prev) =>
        prev.map((track) =>
          track.id === newTrack.id
            ? {
                ...track,
                status: "error",
                note: `Error: ${userMessage}`,
              }
            : track
        )
      );

      syncNotice(`❌ ${userMessage}`);
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
      setGenerateProgress(0);
      generateAbortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">SongMaker</h1>
            <p className="text-xs text-gray-500">Studio musik AI hitam-putih yang simple tapi rapih.</p>
          </div>
          <div className="hidden rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400 sm:block">
            {readyTracks}/{totalTracks} track ready
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-56 pt-6 md:pb-40">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-800 pb-3">
          {(["create", "library", "settings"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === tab
                  ? "bg-white text-black"
                  : "border border-gray-700 text-gray-300 hover:border-gray-500"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-200">
            {notice}
          </div>
        )}

        {view === "create" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-5 rounded-3xl border border-gray-800 bg-[#050505] p-5">
              <div>
                <h2 className="text-xl font-semibold">Create</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Buat musik & suara AI — pilih mode, rapihin prompt, lalu generate.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-300">Mode</label>
                  <span className="text-xs text-gray-500">{draft.mode} mode</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["Simple", "Advanced", "Sounds"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateDraft("mode", mode)}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        draft.mode === mode
                          ? "border-white bg-white text-black"
                          : "border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-300">Title</label>
                    <span className="text-xs text-gray-500">{draft.title.length}/{TITLE_LIMIT}</span>
                  </div>
                  <input
                    type="text"
                    maxLength={TITLE_LIMIT}
                    value={draft.title}
                    onChange={(event) => updateDraft("title", event.target.value)}
                    placeholder="Nama lagu..."
                    className={fieldClassName}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-300">Model version</label>
                    <span className="text-xs text-gray-500">Suno-style selector, backend masih pakai engine internal</span>
                  </div>
                  <select
                    value={draft.model}
                    onChange={(event) => updateDraft("model", event.target.value)}
                    className={fieldClassName}
                  >
                    {MODEL_VERSION_OPTIONS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Instrumental", "Vocal"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateDraft("type", type)}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          draft.type === type
                            ? "border-white bg-white text-black"
                            : "border-gray-700 text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Vocal gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Male", "Female"] as const).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        disabled={draft.type !== "Vocal"}
                        onClick={() => updateDraft("gender", gender)}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          draft.gender === gender && draft.type === "Vocal"
                            ? "border-white bg-white text-black"
                            : "border-gray-700 text-gray-300 hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                  <p className="font-medium text-white">Quick info</p>
                  <p className="mt-2">Mode: {draft.mode}</p>
                  <p>Output: {draft.type}</p>
                  <p>Voice: {draft.type === "Vocal" ? draft.gender : "Tidak dipakai"}</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-300">Deskripsi utama</label>
                  <span className="text-xs text-gray-500">{draft.description.length}/{DESCRIPTION_LIMIT}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(draft.description, "Deskripsi masih kosong.", "Deskripsi berhasil di-copy.")}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-gray-500"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleBoostDescription}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-gray-500"
                  >
                    Boost Style
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft("description", "");
                      syncNotice("Deskripsi dihapus.");
                    }}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-red-500 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
                <textarea
                  value={draft.description}
                  maxLength={DESCRIPTION_LIMIT}
                  onChange={(event) => updateDraft("description", event.target.value)}
                  placeholder="Contoh: upbeat electronic anthem, bright synth, festival drop, energetic beat..."
                  rows={4}
                  className={fieldClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        draft.tags.includes(tag)
                          ? "border-white bg-white text-black"
                          : "border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-300">Lyrics</label>
                  <span className="text-xs text-gray-500">{draft.lyrics.length}/{LYRICS_LIMIT}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(draft.lyrics, "Lyrics masih kosong.", "Lyrics berhasil di-copy.")}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-gray-500"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft("lyrics", "");
                      syncNotice("Lyrics dihapus.");
                    }}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-red-500 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
                <textarea
                  value={draft.lyrics}
                  maxLength={LYRICS_LIMIT}
                  onChange={(event) => updateDraft("lyrics", event.target.value)}
                  placeholder="Isi lirik kalau mau arah vokalnya lebih jelas..."
                  rows={5}
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={generateTrack}
                  disabled={isGenerating}
                  className="relative flex-1 rounded-2xl bg-white px-4 py-3 font-medium text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      <span>{generateProgress}%</span>
                    </div>
                  ) : (
                    "Generate"
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={isGenerating}
                  className="flex-1 rounded-2xl border border-gray-700 px-4 py-3 font-medium text-gray-300 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
                >
                  Clear
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-gray-800 bg-[#050505] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Riwayat</p>
                    <h3 className="text-lg font-semibold">Recent Generations</h3>
                  </div>
                  <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400">
                    {recentTracks.length}
                  </span>
                </div>

                {recentTracks.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">Belum ada lagu. Generate dulu biar riwayat kebaca di sini.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {recentTracks.map((track) => {
                      const status = getStatusMeta(track.status);

                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            setView("library");
                            playTrack(track);
                          }}
                          className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-3 text-left transition hover:border-gray-600"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-medium text-white">{track.title}</p>
                            <span className={`rounded-full border px-2 py-1 text-[11px] ${status.tone}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-gray-400">{track.description}</p>
                          <p className="mt-2 text-[11px] text-gray-500">
                            {new Date(track.createdAt).toLocaleString("id-ID")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-gray-800 bg-[#050505] p-5 text-sm text-gray-400">
                <h3 className="font-semibold text-white">Quick stats</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-gray-800 bg-gray-950 px-3 py-4">
                    <p className="text-lg font-semibold text-white">{readyTracks}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Ready</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950 px-3 py-4">
                    <p className="text-lg font-semibold text-white">{activeGenerations}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Active</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950 px-3 py-4">
                    <p className="text-lg font-semibold text-white">{errorTracks}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Error</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}

        {view === "library" && (
          <section className="rounded-3xl border border-gray-800 bg-[#050505] p-5">
            <div className="flex flex-col gap-4 border-b border-gray-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Koleksi</p>
                <h2 className="text-xl font-semibold">Library</h2>
                <p className="mt-1 text-sm text-gray-400">Semua track yang sudah tersimpan di browser.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshLibrary}
                  className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={clearAllTracks}
                  className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-red-500 hover:text-red-300"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari judul, genre, mode, status..."
                  className={fieldClassName}
                />
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
                <p>
                  <strong className="text-white">{filteredTracks.length}</strong> track tampil
                </p>
                <p className="mt-1 text-xs text-gray-500">Dari total {totalTracks} track tersimpan.</p>
              </div>
            </div>

            {filteredTracks.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">Belum ada track yang cocok. Coba generate dulu atau ubah kata kunci pencarian.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {filteredTracks.map((track) => {
                  const status = getStatusMeta(track.status);
                  const playableAudioUrl = getPlayableAudioUrl(track);
                  const trackThumbnail = getAlbumThumbnailMeta(track);

                  return (
                    <article
                      key={track.id}
                      className={`rounded-3xl border p-4 transition ${
                        nowPlaying?.id === track.id
                          ? "border-white bg-gray-900"
                          : "border-gray-800 bg-gray-950 hover:border-gray-600"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <div
                            className={`relative flex h-16 w-16 shrink-0 items-end justify-start overflow-hidden rounded-2xl bg-gradient-to-br ${trackThumbnail.accentClassName} p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.35)]`}
                          >
                            <img src={trackThumbnail.artworkDataUrl} alt={`Thumbnail ${track.title}`} className="absolute inset-0 h-full w-full object-cover opacity-90" />
                            <div className="absolute inset-0 bg-black/10" />
                            <span className="relative z-10 text-lg font-semibold tracking-[0.18em] text-black/80">{trackThumbnail.initials}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold text-white">{track.title}</h3>
                              <span className={`rounded-full border px-2 py-1 text-[11px] ${status.tone}`}>
                                {status.label}
                              </span>
                              <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                                {track.model}
                              </span>
                              <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                                {track.mode}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-400">{track.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                                {track.type}
                              </span>
                              {track.type === "Vocal" && (
                                <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                                  {track.gender}
                                </span>
                              )}
                              {track.tags.map((tag) => (
                                <span key={tag} className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-xs text-gray-500">{track.note}</p>
                            <p className="mt-1 text-[11px] text-gray-600">
                              {new Date(track.createdAt).toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (nowPlaying?.id === track.id) {
                                void handleTogglePlayback();
                                return;
                              }
                              playTrack(track);
                            }}
                            disabled={!playableAudioUrl}
                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                          >
                            {!playableAudioUrl ? "Belum siap" : nowPlaying?.id === track.id ? (isPlayerPaused ? "Resume" : "Pause") : "Play"}
                          </button>
                          {playableAudioUrl ? (
                            <a
                              href={getDownloadUrl(track)}
                              download={getDownloadFileName(track)}
                              onClick={() => handleDownloadNotice(track)}
                              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
                              title="Download track"
                            >
                              ⬇
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded-full border border-gray-800 px-4 py-2 text-sm text-gray-600 disabled:cursor-not-allowed"
                              title="Download track"
                            >
                              ⬇
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteTrack(track.id)}
                            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-red-500 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {view === "settings" && (
          <section className="space-y-5 rounded-3xl border border-gray-800 bg-[#050505] p-5">
            <div>
              <h2 className="text-xl font-semibold">Settings</h2>
              <p className="mt-1 text-sm text-gray-400">Status backend, model default, dan opsi install app.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Backend aktif</p>
                <p className="mt-3 font-semibold text-white">{activeProviderConfig.label}</p>
                <p className="mt-2 text-xs text-gray-500">Kalau provider butuh key tapi kosong, generate auto fallback ke Modal MusicGen.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Provider pilihan</p>
                <p className="mt-3 font-semibold text-white">{activeProviderConfig.label}</p>
                <p className="mt-2 text-xs text-gray-500">Suno/Kie pakai API key browser. Modal bisa jalan tanpa key tambahan.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Library</p>
                <p className="mt-3 font-semibold text-white">{totalTracks} track</p>
                <p className="mt-2 text-xs text-gray-500">Tersimpan lokal di browser, bukan server.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">PWA</p>
                <p className="mt-3 font-semibold text-white">
                  {isInstallSupported ? "Ready to install" : serviceWorkerReady ? "Service worker ready" : "Belum aktif"}
                </p>
                <p className="mt-2 text-xs text-gray-500">Install biar terasa kayak aplikasi beneran.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Model Version</label>
                  <select
                    value={settings.defaultModel}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, defaultModel: event.target.value }))
                    }
                    className={fieldClassName}
                  >
                    {MODEL_VERSION_OPTIONS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">API Provider</label>
                  <select
                    value={settings.apiProvider}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        apiProvider: event.target.value as ApiProvider,
                      }))
                    }
                    className={fieldClassName}
                  >
                    {PROVIDER_OPTIONS.map((provider) => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-black p-4 text-sm text-gray-400">
                  <p className="font-medium text-white">Endpoint info</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>• Provider: {activeProviderConfig.label}</li>
                    <li>• Base URL: {activeProviderConfig.baseUrl}</li>
                    <li>• Credit path: {activeProviderConfig.creditPath}</li>
                    <li>• Keterangan: {activeProviderConfig.notes}</li>
                  </ul>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-300">API Keys</label>
                    <span className="text-xs text-gray-500">{configuredApiKeyCount} key tersimpan</span>
                  </div>
                  <textarea
                    value={settings.apiKeys}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, apiKeys: event.target.value }))
                    }
                    rows={6}
                    placeholder={`Tempel API key ${activeProviderConfig.label}, satu key per baris...`}
                    className={fieldClassName}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Disimpan lokal di browser ini. Kalau provider Suno/Kie dipilih dan key ada, generate akan pakai provider itu. Kalau key kosong, auto fallback ke Modal.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-black p-4 text-sm text-gray-400">
                  <p className="font-medium text-white">Status Generate</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>• Ready: {readyTracks}</li>
                    <li>• Generating: {activeGenerations}</li>
                    <li>• Error: {errorTracks}</li>
                    <li>• Model default aktif: {settings.defaultModel}</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={saveSettings}
                  className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-gray-200"
                >
                  Save Settings
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Install aplikasi</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">PWA Install</h3>
                  <p className="mt-2 text-sm text-gray-400">
                    Pasang SongMaker di home screen/desktop biar aksesnya lebih cepat.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleInstallApp}
                  disabled={!isInstallSupported}
                  className="w-full rounded-2xl border border-gray-700 px-4 py-3 font-medium text-gray-200 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isInstallSupported ? "Install SongMaker" : "Install belum tersedia"}
                </button>

                <div className="rounded-2xl border border-gray-800 bg-black p-4 text-sm text-gray-500">
                  <p className="font-medium text-white">Checklist PWA</p>
                  <ul className="mt-2 space-y-2">
                    <li>• Manifest: aktif</li>
                    <li>• Service worker: {serviceWorkerReady ? "aktif" : "belum aktif"}</li>
                    <li>• Install prompt: {isInstallSupported ? "siap" : "belum muncul"}</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-black p-4 text-sm text-gray-500">
                  <p>Tip:</p>
                  <p className="mt-2">Kalau tombol install belum muncul, buka pakai Chrome/Edge, refresh sekali, lalu buka menu browser.</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-black/95 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="relative rounded-[28px] border border-gray-800 bg-[#050505] p-4 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]">
              <button
                type="button"
                aria-label="Close player"
                title="Close player"
                onClick={() => setNowPlaying(null)}
                className="absolute right-4 top-4 z-20 rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
              >
                ✕
              </button>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_320px] xl:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={`relative flex h-20 w-20 shrink-0 items-end justify-start overflow-hidden rounded-3xl bg-gradient-to-br ${nowPlayingThumbnail.accentClassName} p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]`}
                  >
                    <img src={nowPlayingThumbnail.artworkDataUrl} alt={`Thumbnail ${nowPlaying.title}`} className="absolute inset-0 h-full w-full object-cover opacity-90" />
                    <div className="absolute inset-0 bg-black/10" />
                    <span className="relative z-10 text-2xl font-semibold tracking-[0.22em] text-black/80">{nowPlayingThumbnail.initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">Now Playing</span>
                      <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
                        {nowPlayingIndex >= 0 ? `${nowPlayingIndex + 1}/${playableQueue.length}` : `${playableQueue.length} ready`}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-lg font-semibold text-white">{nowPlaying.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">{nowPlaying.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                      <span className="rounded-full border border-gray-800 px-2 py-1">{nowPlaying.model}</span>
                      <span className="rounded-full border border-gray-800 px-2 py-1">{nowPlaying.type}</span>
                      {nowPlaying.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full border border-gray-800 px-2 py-1">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setShuffleEnabled((prev) => !prev)}
                      className={`rounded-full border px-3 py-2 text-xs transition ${
                        shuffleEnabled ? "border-white bg-white text-black" : "border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      Shuffle
                    </button>
                    <button
                      type="button"
                      onClick={handlePreviousTrack}
                      className="rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-100 hover:border-gray-500"
                    >
                      ⏮
                    </button>
                    <button
                      type="button"
                      onClick={handleTogglePlayback}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-gray-200"
                    >
                      {isPlayerPaused ? "▶ Play" : "⏸ Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={handleNextTrack}
                      className="rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-100 hover:border-gray-500"
                    >
                      ⏭
                    </button>
                    <button
                      type="button"
                      onClick={cycleRepeatMode}
                      className={`rounded-full border px-3 py-2 text-xs transition ${
                        repeatMode !== "off" ? "border-white bg-white text-black" : "border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {repeatMode === "off" ? "Rpt Off" : repeatMode === "all" ? "Rpt All" : "Rpt 1"}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration, currentTime, 1)}
                      step={0.1}
                      value={Math.min(currentTime, Math.max(duration, currentTime, 1))}
                      onChange={(event) => handleSeek(Number(event.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-800"
                    />
                    <span className="w-10">{Number.isFinite(duration) && duration > 0 ? formatTime(duration) : "--:--"}</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-gray-800 bg-black/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPlayerPanel("queue");
                        setIsPlayerPanelOpen(true);
                      }}
                      className={`rounded-full px-3 py-2 text-xs ${
                        playerPanel === "queue" ? "bg-white text-black" : "border border-gray-700 text-gray-300"
                      }`}
                    >
                      Queue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlayerPanel("lyrics");
                        setIsPlayerPanelOpen(true);
                      }}
                      className={`rounded-full px-3 py-2 text-xs ${
                        playerPanel === "lyrics" ? "bg-white text-black" : "border border-gray-700 text-gray-300"
                      }`}
                    >
                      Lyrics
                    </button>
                    {getDownloadUrl(nowPlaying) ? (
                      <a
                        href={getDownloadUrl(nowPlaying)}
                        download={getDownloadFileName(nowPlaying)}
                        onClick={() => handleDownloadNotice(nowPlaying)}
                        className="rounded-full border border-gray-700 px-3 py-2 text-xs text-gray-300 transition hover:border-gray-500"
                        title="Download track"
                      >
                        ⬇ Download
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded-full border border-gray-800 px-3 py-2 text-xs text-gray-600 disabled:cursor-not-allowed"
                        title="Download track"
                      >
                        ⬇ Download
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={isPlayerPanelOpen ? "Hide panel" : "Show panel"}
                      title={isPlayerPanelOpen ? "Hide panel" : "Show panel"}
                      onClick={() => setIsPlayerPanelOpen((prev) => !prev)}
                      className="ml-auto rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
                    >
                      {isPlayerPanelOpen ? "▾" : "▴"}
                    </button>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Volume</span>
                      <span>{Math.round(playerVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={playerVolume}
                      onChange={(event) => handleVolumeChange(Number(event.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-800"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {nowPlayingLyrics.length > 0
                      ? `${nowPlayingLyrics.length} baris lirik siap dibaca.`
                      : "Belum ada lirik. Cocok buat instrumental atau prompt singkat."}
                  </p>
                </div>
              </div>

              {isPlayerPanelOpen && (
                <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-gray-800 bg-black/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Up Next</p>
                        <h3 className="mt-1 text-sm font-semibold text-white">Queue</h3>
                      </div>
                      <span className="text-xs text-gray-500">{playableQueue.length} ready</span>
                    </div>
                    <div className="space-y-2">
                      {playableQueue.length === 0 ? (
                        <p className="text-sm text-gray-500">Belum ada track ready di library.</p>
                      ) : (
                        playableQueue.slice(0, 6).map((track) => {
                          const queueThumb = getAlbumThumbnailMeta(track);
                          const isActive = nowPlaying?.id === track.id;

                          return (
                            <button
                              key={track.id}
                              type="button"
                              onClick={() => playTrack(track)}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                isActive ? "border-white bg-white/10" : "border-gray-800 hover:border-gray-600"
                              }`}
                            >
                              <div className={`relative flex h-12 w-12 shrink-0 items-end overflow-hidden rounded-2xl bg-gradient-to-br ${queueThumb.accentClassName} p-2`}>
                                <img src={queueThumb.artworkDataUrl} alt={`Thumbnail ${track.title}`} className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                <div className="absolute inset-0 bg-black/10" />
                                <span className="relative z-10 text-xs font-semibold tracking-[0.16em] text-black/80">{queueThumb.initials}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">{track.title}</p>
                                <p className="truncate text-xs text-gray-500">{track.type} • {track.model}</p>
                              </div>
                              {isActive && <span className="text-[11px] text-gray-300">Live</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-800 bg-black/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                          {playerPanel === "lyrics" ? "Lyrics View" : "Player Notes"}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-white">
                          {playerPanel === "lyrics" ? "Lyrics Panel" : "Queue Preview"}
                        </h3>
                      </div>
                      <span className="text-xs text-gray-500">{nowPlaying.type}</span>
                    </div>

                    {playerPanel === "lyrics" ? (
                      nowPlayingLyrics.length > 0 ? (
                        <div className="max-h-52 space-y-2 overflow-y-auto pr-1 text-sm leading-7 text-gray-200">
                          {nowPlayingLyrics.map((line, index) => (
                            <p key={`${nowPlaying.id}-line-${index}`} className="rounded-2xl border border-gray-800 bg-gray-950/80 px-3 py-2">
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950/70 px-4 py-6 text-sm text-gray-500">
                          Belum ada lirik di track ini. Kalau mau panel ini hidup, isi lirik pas generate lagu vocal.
                        </div>
                      )
                    ) : (
                      <div className="space-y-3 text-sm text-gray-400">
                        <p className="rounded-2xl border border-gray-800 bg-gray-950/80 px-4 py-3">
                          Player sekarang udah model Spotify mini: thumbnail, seekbar, shuffle, repeat, queue, lyrics, dan volume.
                        </p>
                        <p className="rounded-2xl border border-gray-800 bg-gray-950/80 px-4 py-3">
                          Tips: pakai tab <span className="text-white">Lyrics</span> buat lagu vocal, dan tab <span className="text-white">Queue</span> buat loncat cepat antar track.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <audio ref={audioRef} preload="metadata" className="hidden" src={nowPlaying.audioUrl || ""} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
