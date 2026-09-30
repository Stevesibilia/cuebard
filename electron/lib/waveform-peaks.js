const BYTES_PER_SAMPLE = 2; // signed 16-bit little-endian, mono

// Reduces raw s16le PCM to at most `targetSamples` absolute peaks in 0..1,
// taken at even intervals across the buffer.
function downsamplePeaks(buffer, targetSamples) {
  const peaks = [];
  if (targetSamples <= 0) return peaks;

  const totalSamples = Math.floor(buffer.length / BYTES_PER_SAMPLE);
  // At least 1: audio shorter than the target would otherwise never advance
  // and repeat its first sample.
  const step = Math.max(1, Math.floor(totalSamples / targetSamples));

  for (let i = 0; i < totalSamples && peaks.length < targetSamples; i += step) {
    peaks.push(Math.abs(buffer.readInt16LE(i * BYTES_PER_SAMPLE) / 32768.0));
  }
  return peaks;
}

module.exports = { downsamplePeaks };
