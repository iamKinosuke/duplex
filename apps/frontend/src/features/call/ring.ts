export type RingTone = "incoming" | "outgoing";

interface Pattern {
  frequencies: number[];
  seconds: number;
  cycleMs: number;
  volume: number;
}

const PATTERNS: Record<RingTone, Pattern> = {
  incoming: { frequencies: [440, 480], seconds: 1, cycleMs: 3_000, volume: 0.1 },
  outgoing: { frequencies: [425], seconds: 1, cycleMs: 4_000, volume: 0.05 },
};

export interface Ringer {
  start: (tone: RingTone) => void;
  stop: () => void;
}

function sound(context: AudioContext, pattern: Pattern): () => void {
  const gain = context.createGain();
  const now = context.currentTime;
  const end = now + pattern.seconds;

  gain.connect(context.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(pattern.volume, now + 0.05);
  gain.gain.setValueAtTime(pattern.volume, end - 0.05);
  gain.gain.linearRampToValueAtTime(0, end);

  const oscillators = pattern.frequencies.map((frequency) => {
    const oscillator = context.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(end);

    return oscillator;
  });

  return () => {
    for (const oscillator of oscillators) {
      try {
        oscillator.stop();
      } catch {
        continue;
      }
    }

    gain.disconnect();
  };
}

export function createRinger(): Ringer {
  let context: AudioContext | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let silence: (() => void) | null = null;

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    silence?.();
    silence = null;
  }

  function cycle(pattern: Pattern): void {
    if (context === null) return;

    silence = sound(context, pattern);
    timer = setTimeout(() => cycle(pattern), pattern.cycleMs);
  }

  return {
    start(tone) {
      clear();

      try {
        context ??= new AudioContext();

        const pattern = PATTERNS[tone];

        if (context.state === "suspended") {
          void context.resume().then(
            () => cycle(pattern),
            () => undefined,
          );
          return;
        }

        cycle(pattern);
      } catch {
        context = null;
      }
    },

    stop() {
      clear();
    },
  };
}
