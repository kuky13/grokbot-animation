export function createRecorder(canvas, onStatus, onVideo) {
  let recorder = null;
  let stream = null;
  let url = null;
  let startedAt = 0;
  let pausedAt = 0;
  let pausedFor = 0;
  let timer = null;
  let discard = false;

  const elapsed = () => Math.max(0, ((pausedAt || performance.now()) - startedAt - pausedFor) / 1000);
  const emit = () => onStatus(recorder?.state || "inactive", elapsed());
  const cleanup = () => {
    clearInterval(timer);
    stream?.getVideoTracks().forEach(track => track.stop());
    stream = null;
  };

  return {
    get state() { return recorder?.state || "inactive"; },
    async start(audioTrack = null) {
      if (recorder?.state !== "inactive" && recorder) return;
      if (!window.MediaRecorder || !canvas.captureStream) throw new Error("Este navegador não suporta gravação de vídeo do canvas.");
      const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Este navegador não oferece gravação WebM. Use um navegador com MediaRecorder WebM.");
      discard = false;
      try {
        stream = canvas.captureStream(60);
        if (audioTrack) stream.addTrack(audioTrack);
        recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];
        recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
        recorder.addEventListener("stop", () => {
          cleanup();
          if (!discard && chunks.length) {
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
            onVideo(url);
          }
          emit();
        }, { once: true });
        recorder.addEventListener("error", () => { cleanup(); emit(); });
        recorder.start(250);
        startedAt = performance.now();
        pausedAt = pausedFor = 0;
        timer = setInterval(emit, 250);
        emit();
      } catch (error) {
        cleanup();
        throw error;
      }
    },
    pause() { if (recorder?.state === "recording") { recorder.pause(); pausedAt = performance.now(); emit(); } },
    resume() { if (recorder?.state === "paused") { pausedFor += performance.now() - pausedAt; pausedAt = 0; recorder.resume(); emit(); } },
    stop() { if (recorder && recorder.state !== "inactive") { recorder.stop(); clearInterval(timer); emit(); } },
    discard() {
      discard = true;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (url) URL.revokeObjectURL(url);
      url = null;
      onVideo(null);
      cleanup();
      emit();
    },
    destroy() { this.discard(); },
  };
}
