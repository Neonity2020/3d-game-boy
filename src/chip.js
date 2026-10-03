/**
 * Tiny WebAudio chip: square/pulse voices and a noise burst, in the spirit
 * of the Game Boy's four sound channels. Everything is synthesised, so there
 * are no assets to load.
 */

const VOLUME = 0.16;

export class Chip {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  /** Must be called from a user gesture or the context stays suspended. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? VOLUME : 0;
  }

  tone({ freq = 440, to = null, dur = 0.06, type = 'square', gain = 1, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.7, delay = 0, hp = 400 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0);
  }

  play(name) {
    switch (name) {
      case 'move':
        this.tone({ freq: 320, dur: 0.028, gain: 0.35 });
        break;
      case 'rotate':
        this.tone({ freq: 520, to: 700, dur: 0.045, gain: 0.4 });
        break;
      case 'locksoft':
        this.tone({ freq: 180, dur: 0.03, gain: 0.25 });
        break;
      case 'clear':
        [0, 0.07, 0.14].forEach((d, i) => {
          this.tone({ freq: 440 * Math.pow(1.26, i), to: 620 * Math.pow(1.26, i), dur: 0.09, gain: 0.5, delay: d });
        });
        this.noise({ dur: 0.22, gain: 0.35, delay: 0.05, hp: 900 });
        break;
      case 'start':
        this.tone({ freq: 392, dur: 0.08, gain: 0.45 });
        this.tone({ freq: 523, dur: 0.08, gain: 0.45, delay: 0.09 });
        this.tone({ freq: 659, dur: 0.16, gain: 0.45, delay: 0.18 });
        break;
      case 'pause':
        this.tone({ freq: 660, to: 300, dur: 0.1, gain: 0.4 });
        break;
      case 'gameover':
        [0, 0.16, 0.32, 0.5].forEach((d, i) => {
          this.tone({ freq: 330 / Math.pow(1.16, i), dur: 0.18, gain: 0.4, delay: d });
        });
        break;
      case 'power':
        this.tone({ freq: 90, to: 1400, dur: 0.35, gain: 0.3, type: 'sawtooth' });
        break;
      case 'click':
        this.noise({ dur: 0.035, gain: 0.25, hp: 1800 });
        break;
      default:
        break;
    }
  }
}