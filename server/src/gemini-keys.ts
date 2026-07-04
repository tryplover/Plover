export interface KeyPoolOptions {
  cooldownMs?: number;
  initialIndex?: number;
}

const DEFAULT_COOLDOWN_MS = 60_000;

export class KeyPool {
  private readonly keys: string[];
  private readonly cooldownMs: number;
  private readonly cooldownUntil: Map<string, number> = new Map();
  private cursor: number;

  constructor(keys: string[], opts: KeyPoolOptions = {}) {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of keys) {
      const k = raw.trim();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(k);
    }
    if (unique.length === 0) {
      throw new Error('KeyPool requires at least one key');
    }
    this.keys = unique;
    this.cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    const idx = opts.initialIndex ?? Math.floor(Math.random() * unique.length);
    this.cursor = ((idx % unique.length) + unique.length) % unique.length;
  }

  static fromEnv(env: NodeJS.ProcessEnv, opts: KeyPoolOptions = {}): KeyPool | null {
    const multi = (env.GEMINI_API_KEYS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (multi.length > 0) return new KeyPool(multi, opts);
    const single = (env.GEMINI_API_KEY ?? '').trim();
    if (single) return new KeyPool([single], opts);
    return null;
  }

  get size(): number {
    return this.keys.length;
  }

  getCurrent(nowMs: number): string | null {
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.cursor + i) % this.keys.length;
      const key = this.keys[idx];
      if (key === undefined) continue;
      const until = this.cooldownUntil.get(key);
      if (until === undefined || until <= nowMs) {
        this.cursor = (idx + 1) % this.keys.length;
        return key;
      }
    }
    return null;
  }

  markExhausted(key: string, nowMs: number): void {
    if (!this.keys.includes(key)) return;
    this.cooldownUntil.set(key, nowMs + this.cooldownMs);
    const currentIdx = this.keys.indexOf(key);
    if (currentIdx === this.cursor) {
      this.cursor = (this.cursor + 1) % this.keys.length;
    }
  }

  fingerprint(key: string): string {
    if (key.length <= 8) return `${key}…${key}`;
    return `${key.slice(0, 4)}…${key.slice(-4)}`;
  }
}
