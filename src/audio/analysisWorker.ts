/// <reference lib="webworker" />
// Analysis worker: receives raw microphone blocks from the AudioWorklet,
// runs pitch/level analysis and sends frames to the main thread.
// Also keeps a copy of the PCM while recording.
import { FrameAnalyzer, type Frame } from './dsp';

let analyzer: FrameAnalyzer | null = null;
let ring: Float32Array = new Float32Array(8192);
let ringFill = 0;
let recording = false;
let recChunks: Float32Array[] = [];
let recStart = 0;
let sampleRate = 48000;

function onBlock(samples: Float32Array, tEnd: number) {
  if (!analyzer) return;
  const W = analyzer.windowSize;
  // shift ring buffer and append
  if (ringFill + samples.length > ring.length) {
    const keep = W;
    ring.copyWithin(0, ringFill - keep, ringFill);
    ringFill = keep;
  }
  ring.set(samples, ringFill);
  ringFill += samples.length;
  if (recording) {
    if (recStart < 0) recStart = tEnd - samples.length / sampleRate;
    recChunks.push(samples.slice());
  }
  if (ringFill < W) return;
  const win = ring.subarray(ringFill - W, ringFill);
  const t = tEnd - W / 2 / sampleRate;
  const frame: Frame = analyzer.analyze(win, t);
  (self as unknown as Worker).postMessage({ type: 'frame', frame });
}

self.onmessage = (e: MessageEvent) => {
  const d = e.data;
  switch (d.type) {
    case 'init': {
      sampleRate = d.sampleRate;
      analyzer = new FrameAnalyzer({ sampleRate, a4: d.a4, gateDb: d.gateDb });
      ring = new Float32Array(Math.max(8192, analyzer.windowSize * 4));
      ringFill = 0;
      const port: MessagePort = d.port;
      port.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'block') onBlock(ev.data.samples, ev.data.tEnd);
      };
      break;
    }
    case 'config': {
      if (analyzer) {
        if (typeof d.a4 === 'number') analyzer.a4 = d.a4;
        if (typeof d.gateDb === 'number') analyzer.gateDb = d.gateDb;
      }
      break;
    }
    case 'recStart': {
      recording = true;
      recChunks = [];
      recStart = -1;
      break;
    }
    case 'recStop': {
      recording = false;
      const len = recChunks.reduce((a, b) => a + b.length, 0);
      const pcm = new Float32Array(len);
      let o = 0;
      for (const c of recChunks) {
        pcm.set(c, o);
        o += c.length;
      }
      recChunks = [];
      (self as unknown as Worker).postMessage({ type: 'recording', pcm, sampleRate, start: recStart }, [pcm.buffer]);
      break;
    }
  }
};
