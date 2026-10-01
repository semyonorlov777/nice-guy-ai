// Простые операции над PCM16 моно (little-endian).

/** Пересэмплирование линейной интерполяцией. Для речи достаточно. */
export function resamplePcm16(input: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate) return input;
  const src = new Int16Array(input.buffer, input.byteOffset, Math.floor(input.length / 2));
  const outLen = Math.floor((src.length * toRate) / fromRate);
  const out = new Int16Array(outLen);
  const step = fromRate / toRate;
  for (let i = 0; i < outLen; i++) {
    const pos = i * step;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, src.length - 1);
    const f = pos - i0;
    out[i] = Math.round(src[i0] * (1 - f) + src[i1] * f);
  }
  return Buffer.from(out.buffer);
}

/** Почти тишина: слабый шум ±8, чистые нули VAD Gemini 3.8 не закрывает. */
export function quietNoise(ms: number, rate: number): Buffer {
  const n = Math.floor((rate * ms) / 1000);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round((Math.random() * 2 - 1) * 8);
  return Buffer.from(out.buffer);
}

export function wavFile(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
