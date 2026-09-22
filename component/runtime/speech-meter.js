// Reusing a media element must reuse its MediaElementSource, even after disconnect.
const mediaSources = new WeakMap();

export function createSpeechMeter(context, output) {
  if (!context?.createAnalyser) return () => 0;
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  output.connect(analyser); // Analysis branch only: the audible route remains untouched.
  const samples = new Float32Array(analyser.fftSize);
  const read = () => {
    if (context.state !== "running") return 0;
    analyser.getFloatTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    return Math.min(1, Math.max(0, Math.sqrt(energy / samples.length) - 0.003) * 12);
  };
  read.disconnect = () => { output.disconnect(analyser); analyser.disconnect(); };
  return read;
}

export async function connectSpeechAudio(engine, element) {
  if (!(element instanceof HTMLMediaElement)) throw new TypeError("connectAudio requires an audio or video element");
  // Web Audio silences cross-origin media without CORS. Refuse before rerouting it.
  const url = element.currentSrc || element.src;
  if (url && new URL(url, document.baseURI).origin !== location.origin && !element.crossOrigin)
    throw new TypeError("Cross-origin audio requires crossOrigin='anonymous' and server CORS headers");
  let record = mediaSources.get(element);
  if (!record) {
    const context = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    try {
      const source = context.createMediaElementSource(element);
      source.connect(context.destination);
      record = { context, source };
      mediaSources.set(element, record);
    } catch (error) { await context.close(); throw error; }
  }
  await record.context.resume(); // Caller invokes from a user gesture; never starts playback.
  engine.disconnectAudio();
  const meter = createSpeechMeter(record.context, record.source);
  engine.externalSpeech = () => element.paused || element.ended || element.seeking ? 0 : meter();
  engine.releaseSpeechAudio = () => meter.disconnect?.();
  engine.manualSpeech = null;
}
