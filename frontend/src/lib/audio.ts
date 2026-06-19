const cache = new Map<string, HTMLAudioElement>();

export function playSound(src: string) {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    cache.set(src, audio);
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

let musicEl: HTMLAudioElement | null = null;
let currentMusicSrc: string | null = null;

export function playMusic(src: string) {
  if (currentMusicSrc === src && musicEl && !musicEl.paused) return;
  stopMusic();
  musicEl = new Audio(src);
  musicEl.loop = true;
  musicEl.play().catch(() => {});
  currentMusicSrc = src;
}

export function stopMusic() {
  if (musicEl) {
    musicEl.pause();
    musicEl.currentTime = 0;
    musicEl = null;
    currentMusicSrc = null;
  }
}
