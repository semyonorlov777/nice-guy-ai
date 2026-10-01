// Захват микрофона: float32 на частоте устройства → PCM16 16 кГц кадрами по 40 мс.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0;
    this.frame = new Int16Array(640);
    this.n = 0;
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.t === "mute") this.muted = !!e.data.muted;
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || this.muted) return true;
    // Простое понижение частоты: среднее по окну (сглаживает наложение частот для речи).
    while (this.pos < ch.length) {
      const i0 = Math.floor(this.pos);
      const i1 = Math.min(ch.length, Math.floor(this.pos + this.ratio));
      let sum = 0;
      let cnt = 0;
      for (let i = i0; i < Math.max(i1, i0 + 1); i++) {
        sum += ch[i];
        cnt++;
      }
      const v = Math.max(-1, Math.min(1, sum / cnt));
      this.frame[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.frame.length) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Int16Array(640);
        this.n = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
