export async function resampleTo16kMono(buffer: AudioBuffer): Promise<Float32Array> {
  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(buffer.duration * targetRate),
    targetRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  // Connecting a multi-channel source into a 1-channel destination triggers
  // the Web Audio API's standard downmix (summed/averaged), which is what we want.
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
