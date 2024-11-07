const fs = require('fs');
const wav = require('wav');
const { exec } = require('child_process');

// Frequencies for binary 0 and 1, within 1000 Hz to 5000 Hz range
const FREQ_ZERO = 1500;  // 1.5 kHz for bit 0
const FREQ_ONE = 3000;   // 3.0 kHz for bit 1
const SAMPLE_RATE = 44100;  // Standard sample rate
const BIT_DURATION = 0.02;  // 0.02 seconds per bit (for a higher bitrate)
const SILENCE_THRESHOLD = 1000;  // Amplitude threshold to detect silence

// Error correction parameters
const REPEATED_BIT_COUNT = 3;  // Number of repetitions for each bit (for error correction)
const TOLERANCE = 50;  // Tolerance for frequency detection (Hz)

function textToBinary(text) {
  return text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
}

function generateToneForBit(bit) {
  const numSamples = SAMPLE_RATE * BIT_DURATION;
  const toneBuffer = Buffer.alloc(numSamples * 2);

  const frequency = bit === '0' ? FREQ_ZERO : FREQ_ONE;

  for (let i = 0; i < numSamples; i++) {
    const time = i / SAMPLE_RATE;
    const sample = Math.sin(2 * Math.PI * frequency * time);
    const intVal = Math.round(sample * 32767);  // Scale to 16-bit integer
    toneBuffer.writeInt16LE(intVal, i * 2);
  }

  return toneBuffer;
}

function encodeDataToToneBuffer(binaryData) {
  const toneBuffers = binaryData.split('').map(generateToneForBit);
  return Buffer.concat(toneBuffers);
}

function createWavFile(binaryData, filePath) {
  const writer = new wav.Writer({
    channels: 1,
    sampleRate: SAMPLE_RATE,
    bitDepth: 16,
  });

  const audioBuffer = encodeDataToToneBuffer(binaryData);

  writer.pipe(fs.createWriteStream(filePath));
  writer.write(audioBuffer);
  writer.end();
}

// Step 2: Decode WAV to Binary Data with Robust Frequency Detection
function decodeWavToBinaryWithErrorCorrection(wavFilePath) {
  return new Promise((resolve, reject) => {
    const reader = new wav.Reader();
    const binaryArray = [];
    let inSilence = true;
    let startSample = 0;
    let endSample = 0;

    reader.on('data', (chunk) => {
      for (let i = 0; i < chunk.length / 2; i++) {
        const sample = chunk.readInt16LE(i * 2);
        
        if (Math.abs(sample) > SILENCE_THRESHOLD) {
          if (inSilence) {
            startSample = i;
            inSilence = false;
          }
          endSample = i;
        }

        const decodedBits = decodeSampleToBits(sample);
        binaryArray.push(decodedBits);
      }
    });

    reader.on('end', () => {
      const trimmedBinaryData = binaryArray.slice(startSample / 2, endSample / 2);
      const correctedData = applyMajorityVoting(trimmedBinaryData);
      resolve(correctedData);
    });

    reader.on('error', (err) => reject(err));

    fs.createReadStream(wavFilePath).pipe(reader);
  });
}

function decodeSampleToBits(sample) {
  const sampleNormalized = sample / 32767;
  const frequency = Math.abs(sampleNormalized) * 2500;
  const detectedFrequency = (Math.abs(frequency - FREQ_ZERO) < TOLERANCE) ? FREQ_ZERO : FREQ_ONE;
  return detectedFrequency === FREQ_ZERO ? '0' : '1';
}

function applyMajorityVoting(bits) {
  const correctedBits = [];
  for (let i = 0; i < bits.length; i += REPEATED_BIT_COUNT) {
    const bitGroup = bits.slice(i, i + REPEATED_BIT_COUNT);
    const majorityBit = bitGroup.reduce((acc, bit) => acc + parseInt(bit, 10), 0) >= REPEATED_BIT_COUNT / 2 ? '1' : '0';
    correctedBits.push(majorityBit);
  }
  return correctedBits.join('');
}

function binaryToBuffer(binary) {
  const buffer = Buffer.alloc(binary.length / 8);
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.slice(i, i + 8);
    buffer.writeUInt8(parseInt(byte, 2), i / 8);
  }
  return buffer;
}

function writeBinaryToZip(binaryData, outputFilePath) {
  const rawBuffer = binaryToBuffer(binaryData);
  fs.writeFileSync(outputFilePath, rawBuffer);
  console.log(`Reconstructed file saved as ${outputFilePath}`);
}

// Full process function
async function processAudioToZip(m4aFilePath, zipOutputPath) {
  try {
    const wavFilePath = 'output.wav';

    await convertM4AtoWav(m4aFilePath, wavFilePath);

    const binaryData = await decodeWavToBinaryWithErrorCorrection(wavFilePath);

    writeBinaryToZip(binaryData, zipOutputPath);

    console.log('Process completed successfully!');
  } catch (error) {
    console.error('Error during processing:', error);
  }
}

// Example usage
const m4aFilePath = 'input.m4a';  // Replace with your .m4a file path
const zipOutputPath = 'reconstructed.zip';  // Output file path for the ZIP

processAudioToZip(m4aFilePath, zipOutputPath);
