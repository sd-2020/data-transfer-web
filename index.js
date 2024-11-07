const fs = require('fs');
const wav = require('wav');

// Frequencies for representing 4 bits (16 combinations)
const FREQUENCIES = [
  1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500
];

// WAV settings
const SAMPLE_RATE = 88200;  // Increased sample rate for higher precision
const BIT_DURATION = 0.02;  // Duration of each bit group (4 bits)

// Convert a file to binary data
function fileToBinary(filePath) {
  const data = fs.readFileSync(filePath);
  return Array.from(data).map(byte => byte.toString(2).padStart(8, '0')).join('');
}

// Map 4 bits to a frequency index
function binaryToFrequency(binary) {
  const index = parseInt(binary, 2);  // Convert binary to a number
  return FREQUENCIES[index];  // Map to frequency
}

// Generate tone buffer for 4 bits (16 possible values)
function generateToneForByte(byte) {
  const numSamples = SAMPLE_RATE * BIT_DURATION;
  const toneBuffer = Buffer.alloc(numSamples * 2); // 16-bit mono

  const frequency = binaryToFrequency(byte);

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

  const audioBuffer = [];
  for (let i = 0; i < binaryData.length; i += 4) {
    const byte = binaryData.slice(i, i + 4);  // Group every 4 bits
    audioBuffer.push(generateToneForByte(byte));
  }

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
