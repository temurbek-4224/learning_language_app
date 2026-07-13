type WordAudioInput = {
  term: string;
  audioUrl?: string | null;
};

function speakWithBrowser(term: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(term);
  utterance.lang = "en-US";
  const englishVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }
  window.speechSynthesis.speak(utterance);
}

export function playWordAudio({ term, audioUrl }: WordAudioInput) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.speechSynthesis?.cancel();

  if (!audioUrl) {
    speakWithBrowser(term);
    return () => window.speechSynthesis?.cancel();
  }

  const audio = new Audio(audioUrl);
  audio.preload = "auto";
  void audio.play().catch(() => {
    speakWithBrowser(term);
  });

  return () => {
    audio.pause();
    audio.currentTime = 0;
    window.speechSynthesis?.cancel();
  };
}
