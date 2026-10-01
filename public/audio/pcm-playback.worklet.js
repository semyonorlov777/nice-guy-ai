// Воспроизведение голоса клиента: PCM16 24 кГц → частота устройства, очередь с очисткой при перебивании.
class PcmPlayback extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = 24000 / sampleRate;
    this.queue = [];
    this.cur = null;
    this.pos = 0;
    this.playing = false;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d instanceof ArrayBuffer) {
        const i16 = new Int16Array(d);
        const f = new Float32Array(i16.length);
        for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 0x8000;
        this.queue.push(f);
      } else if (d && d.t === "flush") {
        this.queue = [];
        this.cur = null;
        this.pos = 0;
      }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    let wrote = false;
    for (let i = 0; i < out.length; i++) {
      if (!this.cur || this.pos >= this.cur.length - 1) {
        if (this.cur) this.pos -= this.cur.length;
        this.cur = this.queue.shift() || null;
        if (!this.cur) {
          this.pos = 0;
          out[i] = 0;
          continue;
        }
        if (this.pos < 0) this.pos = 0;
      }
      const i0 = Math.floor(this.pos);
      const fr = this.pos - i0;
      const a = this.cur[i0];
      const b = this.cur[Math.min(i0 + 1, this.cur.length - 1)];
      out[i] = a + (b - a) * fr;
      this.pos += this.step;
      wrote = true;
    }
    if (wrote !== this.playing) {
      this.playing = wrote;
      this.port.postMessage({ t: "playing", playing: wrote });
    }
    return true;
  }
}
registerProcessor("pcm-playback", PcmPlayback);
