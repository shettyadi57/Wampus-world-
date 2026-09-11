/**
 * SeededRNG.js
 * ─────────────────────────────────────────────────────────────
 * Deterministic pseudo-random number generator (Mulberry32)
 * with multi-octave 2D coherent elevation noise.
 */

export class SeededRNG {
  /**
   * @param {number|string} seed
   */
  constructor(seed = 42) {
    this._initialSeed = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
    this._state = this._initialSeed;
  }

  /**
   * Return next pseudo-random float in [0, 1).
   * @returns {number}
   */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Return integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Return float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextFloat(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Fisher-Yates shuffle array (returns shallow copy).
   * @template T
   * @param {T[]} array
   * @returns {T[]}
   */
  shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Pick single random item from array.
   * @template T
   * @param {T[]} array
   * @returns {T|undefined}
   */
  pick(array) {
    if (!array.length) return undefined;
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Sample k distinct elements from array.
   * @template T
   * @param {T[]} array
   * @param {number} k
   * @returns {T[]}
   */
  sample(array, k) {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(k, shuffled.length));
  }

  /**
   * 2D smooth value noise with cubic Hermite interpolation.
   * @param {number} x
   * @param {number} y
   * @returns {number} ∈ [0, 1]
   */
  noise2D(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    // Smoothstep
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const s00 = this._cellHash(xi, yi);
    const s10 = this._cellHash(xi + 1, yi);
    const s01 = this._cellHash(xi, yi + 1);
    const s11 = this._cellHash(xi + 1, yi + 1);

    const nx0 = s00 + u * (s10 - s00);
    const nx1 = s01 + u * (s11 - s01);
    return nx0 + v * (nx1 - nx0);
  }

  /**
   * Multi-octave fractal Brownian motion (fBm) elevation noise.
   * @param {number} x
   * @param {number} y
   * @param {number} [octaves=3]
   * @param {number} [persistence=0.5]
   * @param {number} [lacunarity=2.0]
   * @returns {number} ∈ [0, 1]
   */
  octaveNoise2D(x, y, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  _cellHash(x, y) {
    let h = this._initialSeed ^ (x * 374761393) ^ (y * 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
