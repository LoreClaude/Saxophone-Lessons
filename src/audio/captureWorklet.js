// AudioWorklet processor: collects microphone samples into 512-sample blocks
// and forwards them (with their AudioContext timestamp) to the analysis worker
// through a MessagePort handed over by the main thread.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = 512;
    this.buf = new Float32Array(this.block);
    this.fill = 0;
    this.out = null;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'port') this.out = e.data.port;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    let i = 0;
    while (i < ch.length) {
      const n = Math.min(this.block - this.fill, ch.length - i);
      this.buf.set(ch.subarray(i, i + n), this.fill);
      this.fill += n;
      i += n;
      if (this.fill === this.block) {
        // time of the end of this block in context seconds
        // eslint-disable-next-line no-undef
        const tEnd = currentTime + (i / sampleRate);
        if (this.out) {
          const copy = this.buf.slice();
          this.out.postMessage({ type: 'block', samples: copy, tEnd }, [copy.buffer]);
        }
        this.fill = 0;
      }
    }
    return true;
  }
}

registerProcessor('sax-capture', CaptureProcessor);
