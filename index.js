const fs = require('fs');
const wav = require('wav');

// Frequencies for binary '0' and '1'
const FREQ_ZERO = 1000;
const FREQ_ONE = 2000;

// WAV settings
const SAMPLE_RATE = 44100;
const BIT_DURATION = 0.1;  // Duration of each bit (in seconds)

// Read raw binary data from a file (ZIP or any file)
function fileToBinary(filePath) {
  const data = fs.readFileSync(filePath);
  return Array.from(data).map(byte => byte.toString(2).padStart(8, '0')).join('');
}

// Generate tone for each bit
function generateToneForBit(bit) {
  const numSamples = SAMPLE_RATE * BIT_DURATION;
  const toneBuffer = Buffer.alloc(numSamples * 2); // 16-bit mono

  const frequency = bit === '0' ? FREQ_ZERO : FREQ_ONE;

  for (let i = 0; i < numSamples; i++) {
    const time = i / SAMPLE_RATE;
    const sample = Math.sin(2 * Math.PI * frequency * time);
    const intVal = Math.round(sample * 32767); // Convert to 16-bit integer
    toneBuffer.writeInt16LE(intVal, i * 2);
  }

  return toneBuffer;
}

// Convert binary data to audio (WAV)
function binaryToWav(binaryData, outputWavFile) {
  const writer = new wav.Writer({
    channels: 1,
    sampleRate: SAMPLE_RATE,
    bitDepth: 16
  });

  const audioBuffer = binaryData.split('').map(generateToneForBit);
  const combinedBuffer = Buffer.concat(audioBuffer);

  writer.pipe(fs.createWriteStream(outputWavFile));
  writer.write(combinedBuffer);
  writer.end();
}

// Convert ZIP file to WAV
function zipToWav(zipFilePath, outputWavFile) {
  const binaryData = fileToBinary(zipFilePath);
  binaryToWav(binaryData, outputWavFile);
  console.log(`WAV file created: ${outputWavFile}`);
}

// Example usage
const zipFilePath = 'example.zip'; // Your ZIP file path
const outputWavFile = 'encoded_audio.wav'; // Output WAV file
zipToWav(zipFilePath, outputWavFile);
