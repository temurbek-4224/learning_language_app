type WordAudioInput = {
  term: string;
  audioUrl?: string | null;
};

const PREFERRED_VOICE_NAMES = [
  "Google US English",
  "Google UK English",
  "Microsoft Zira",
  "Microsoft David",
  "Samantha",
  "Daniel",
  "Alex",
];

let activePlaybackCleanup: (() => void) | null = null;

function isEnglishVoice(voice: SpeechSynthesisVoice) {
  return /^en(?:-|_)/i.test(voice.lang);
}

function selectEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter(isEnglishVoice);

  for (const preferredName of PREFERRED_VOICE_NAMES) {
    const preferred = englishVoices.find((voice) =>
      voice.name.toLowerCase().includes(preferredName.toLowerCase()),
    );
    if (preferred) {
      return preferred;
    }
  }

  return (
    englishVoices.find((voice) => /^en-US$/i.test(voice.lang)) ??
    englishVoices.find((voice) => /^en-GB$/i.test(voice.lang)) ??
    englishVoices[0] ??
    null
  );
}

function speakWithBrowser(term: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => undefined;
  }

  const synthesis = window.speechSynthesis;
  let cancelled = false;
  let voicesChangedHandler: (() => void) | null = null;
  let voiceLoadTimer: number | null = null;

  const cleanup = () => {
    cancelled = true;
    if (voicesChangedHandler) {
      synthesis.removeEventListener("voiceschanged", voicesChangedHandler);
    }
    if (voiceLoadTimer !== null) {
      window.clearTimeout(voiceLoadTimer);
    }
    synthesis.cancel();
  };

  const speak = (voices: SpeechSynthesisVoice[]) => {
    if (cancelled) {
      return;
    }

    const selectedVoice = selectEnglishVoice(voices);
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 1;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      console.warn("English pronunciation voice not found", {
        term,
        hasAudioUrl: false,
        audioSource: "speechSynthesis",
      });
    }

    console.info("Word pronunciation", {
      term,
      hasAudioUrl: false,
      audioSource: "speechSynthesis",
      selectedVoice: selectedVoice
        ? { name: selectedVoice.name, lang: selectedVoice.lang }
        : null,
    });
    synthesis.cancel();
    synthesis.speak(utterance);
  };

  const initialVoices = synthesis.getVoices();
  if (selectEnglishVoice(initialVoices)) {
    speak(initialVoices);
    return cleanup;
  }

  voicesChangedHandler = () => {
    const voices = synthesis.getVoices();
    if (!selectEnglishVoice(voices)) {
      return;
    }
    if (voiceLoadTimer !== null) {
      window.clearTimeout(voiceLoadTimer);
      voiceLoadTimer = null;
    }
    if (voicesChangedHandler) {
      synthesis.removeEventListener("voiceschanged", voicesChangedHandler);
      voicesChangedHandler = null;
    }
    speak(voices);
  };
  synthesis.addEventListener("voiceschanged", voicesChangedHandler);
  voiceLoadTimer = window.setTimeout(() => {
    if (voicesChangedHandler) {
      synthesis.removeEventListener("voiceschanged", voicesChangedHandler);
      voicesChangedHandler = null;
    }
    voiceLoadTimer = null;
    speak(synthesis.getVoices());
  }, 1_000);

  return cleanup;
}

export function playWordAudio({ term, audioUrl }: WordAudioInput) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  activePlaybackCleanup?.();

  let cleanup: () => void;
  if (audioUrl) {
    window.speechSynthesis?.cancel();
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    console.info("Word pronunciation", {
      term,
      hasAudioUrl: true,
      audioSource: "mp3",
    });
    void audio.play().catch(() => {
      console.warn("MP3 pronunciation playback failed", {
        term,
        hasAudioUrl: true,
        audioSource: "mp3",
      });
    });
    cleanup = () => {
      audio.pause();
      audio.currentTime = 0;
      window.speechSynthesis?.cancel();
    };
  } else {
    cleanup = speakWithBrowser(term);
  }

  activePlaybackCleanup = cleanup;
  return () => {
    cleanup();
    if (activePlaybackCleanup === cleanup) {
      activePlaybackCleanup = null;
    }
  };
}
