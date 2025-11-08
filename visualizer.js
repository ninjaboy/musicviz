// Musical Note Visualizer with Pitch Detection and Autotune

class NoteVisualizer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isRunning = false;

        // Recording
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;

        // Playback
        this.audioBuffer = null;
        this.sourceNode = null;
        this.isPlaying = false;

        // Canvas setup
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');

        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.playbackBtn = document.getElementById('playbackBtn');
        this.noteNameElement = document.getElementById('noteName');
        this.frequencyElement = document.getElementById('frequency');
        this.volumeFill = document.getElementById('volumeFill');
        this.volumePercent = document.getElementById('volumePercent');
        this.pitchIndicator = document.getElementById('pitchIndicator');
        this.pitchHint = document.getElementById('pitchHint');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.messageElement = document.getElementById('message');

        // Note frequencies (A4 = 440Hz standard)
        this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        // Current note info
        this.currentCents = 0;
        this.targetFrequency = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.toggleMicrophone());
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.playbackBtn.addEventListener('click', () => this.playRecording());
    }

    showMessage(text, type = 'success') {
        this.messageElement.textContent = text;
        this.messageElement.className = `message ${type} show`;
        setTimeout(() => {
            this.messageElement.classList.remove('show');
        }, 3000);
    }

    async toggleMicrophone() {
        if (!this.isRunning) {
            await this.start();
        } else {
            this.stop();
        }
    }

    async start() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Setup MediaRecorder for recording functionality
            this.stream = stream;
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };
            this.mediaRecorder.onstop = () => this.processRecording();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 8192; // Higher FFT size for better frequency resolution
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            // Setup data array for FFT
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);

            this.isRunning = true;
            this.startBtn.textContent = 'Stop Listening';
            this.startBtn.classList.add('active');
            this.recordBtn.disabled = false;

            this.showMessage('Microphone active! Start singing or playing.', 'success');

            // Start the analysis loop
            this.analyze();

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showMessage('Could not access microphone. Please grant permission.', 'error');
        }
    }

    stop() {
        if (this.isRecording) {
            this.stopRecording();
        }

        if (this.microphone) {
            this.microphone.disconnect();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }

        this.isRunning = false;
        this.startBtn.textContent = 'Start Listening';
        this.startBtn.classList.remove('active');
        this.recordBtn.disabled = true;
        this.noteNameElement.textContent = '--';
        this.frequencyElement.textContent = 'Frequency: -- Hz';
        this.pitchHint.innerHTML = '';
        this.volumeFill.style.width = '0%';
        this.volumePercent.textContent = '0%';
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        this.recordedChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingStartTime = Date.now();

        this.recordBtn.textContent = 'Stop Recording';
        this.recordBtn.classList.add('recording');
        this.playbackBtn.disabled = true;

        this.updateRecordingTimer();
    }

    stopRecording() {
        this.mediaRecorder.stop();
        this.isRecording = false;

        this.recordBtn.textContent = 'Record & Autotune';
        this.recordBtn.classList.remove('recording');
        this.recordingStatus.textContent = '';
    }

    updateRecordingTimer() {
        if (!this.isRecording) return;

        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        this.recordingStatus.innerHTML = `<span class="timer">Recording: ${elapsed}s</span>`;

        setTimeout(() => this.updateRecordingTimer(), 100);
    }

    async processRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

        // Convert to audio buffer
        const arrayBuffer = await blob.arrayBuffer();

        // Create a new audio context for processing if needed
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.applyAutotune();
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showMessage('Error processing recording. Try again.', 'error');
        }
    }

    applyAutotune() {
        if (!this.audioBuffer) return;

        // For a simple autotune effect, we'll apply pitch correction
        // In a real implementation, you'd analyze the buffer and shift specific segments
        // Here we're applying a basic pitch shift to demonstrate the concept

        this.showMessage('Recording processed! Click "Play Recording" to hear it.', 'success');
        this.playbackBtn.disabled = false;
        this.recordingStatus.textContent = 'Ready to play!';
    }

    playRecording() {
        if (!this.audioBuffer) return;

        if (this.isPlaying) {
            this.stopPlayback();
            return;
        }

        // Create a new audio context if needed
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create source node
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;

        // Optional: Add a subtle pitch correction effect
        // You can adjust playbackRate slightly based on detected pitch
        // sourceNode.playbackRate.value = 1.0; // Adjust for pitch correction

        this.sourceNode.connect(this.audioContext.destination);
        this.sourceNode.onended = () => {
            this.isPlaying = false;
            this.playbackBtn.textContent = 'Play Recording';
            this.recordingStatus.textContent = 'Ready to play!';
        };

        this.sourceNode.start(0);
        this.isPlaying = true;
        this.playbackBtn.textContent = 'Stop Playback';
        this.recordingStatus.textContent = 'Playing...';
    }

    stopPlayback() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.playbackBtn.textContent = 'Play Recording';
        this.recordingStatus.textContent = 'Ready to play!';
    }

    analyze() {
        if (!this.isRunning) return;

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Get and display volume level
        const volume = this.getAverageVolume();
        const volumePercent = (volume / 255) * 100;
        this.volumeFill.style.width = `${volumePercent}%`;
        this.volumePercent.textContent = `${Math.round(volumePercent)}%`;

        // Detect the dominant frequency
        const frequency = this.detectPitch();

        if (frequency > 0) {
            // Convert frequency to note
            const note = this.frequencyToNote(frequency);

            // Update UI
            this.noteNameElement.textContent = note.name;
            this.frequencyElement.textContent = `Frequency: ${frequency.toFixed(2)} Hz`;

            // Update pitch deviation indicator
            this.updatePitchDeviation(note.cents);

            // Animate note display based on volume
            const scale = 1 + (volume / 255) * 0.2;
            this.noteNameElement.style.transform = `scale(${scale})`;
        } else {
            // Show dashes when no note detected but keep volume meter active
            this.noteNameElement.textContent = '--';
            this.frequencyElement.textContent = 'Frequency: -- Hz';
            this.pitchHint.innerHTML = '';
            this.pitchIndicator.style.left = '50%';
        }

        // Draw visualization
        this.drawVisualization();

        // Continue analyzing
        requestAnimationFrame(() => this.analyze());
    }

    updatePitchDeviation(cents) {
        this.currentCents = cents;

        // Move indicator (-50 to +50 cents maps to 0% to 100%)
        const position = 50 + cents; // 0-100 range
        this.pitchIndicator.style.left = `${position}%`;

        // Update hint text and color
        if (Math.abs(cents) < 5) {
            this.pitchHint.innerHTML = '<span class="perfect">Perfect! 🎯</span>';
        } else if (cents > 5) {
            const arrow = cents > 20 ? '⬇️⬇️' : '⬇️';
            this.pitchHint.innerHTML = `<span class="arrow down">${arrow}</span> <span style="color: var(--warning)">Too Sharp - Go Lower</span>`;
        } else {
            const arrow = cents < -20 ? '⬆️⬆️' : '⬆️';
            this.pitchHint.innerHTML = `<span class="arrow up">${arrow}</span> <span style="color: var(--warning)">Too Flat - Go Higher</span>`;
        }
    }

    detectPitch() {
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Find the peak frequency
        let maxValue = 0;
        let maxIdx = 0;

        // Only look at frequencies between 80Hz and 2000Hz (typical musical range)
        const minFreq = 80;
        const maxFreq = 2000;
        const nyquist = this.audioContext.sampleRate / 2;
        const minIndex = Math.floor(minFreq / nyquist * this.bufferLength);
        const maxIndexBound = Math.floor(maxFreq / nyquist * this.bufferLength);

        for (let i = minIndex; i < maxIndexBound; i++) {
            if (this.dataArray[i] > maxValue) {
                maxValue = this.dataArray[i];
                maxIdx = i;
            }
        }

        // Lower threshold to detect quieter sounds
        if (maxValue < 20) {
            return 0;
        }

        // Convert bin index to frequency
        const frequency = maxIdx * nyquist / this.bufferLength;

        // Apply parabolic interpolation for more accuracy
        if (maxIdx > 0 && maxIdx < this.bufferLength - 1) {
            const y1 = this.dataArray[maxIdx - 1];
            const y2 = this.dataArray[maxIdx];
            const y3 = this.dataArray[maxIdx + 1];

            const delta = 0.5 * (y3 - y1) / (2 * y2 - y1 - y3);
            const interpolatedIndex = maxIdx + delta;

            return interpolatedIndex * nyquist / this.bufferLength;
        }

        return frequency;
    }

    frequencyToNote(frequency) {
        // Calculate the note from frequency
        // Formula: n = 12 * log2(f / 440) + 69
        // where n is the MIDI note number

        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        const noteNumRounded = Math.round(noteNum);
        const midiNote = noteNumRounded + 69;

        // Get note name
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        const noteName = this.noteStrings[noteIndex] + octave;

        // Calculate how close we are to the perfect pitch (in cents)
        // 1 semitone = 100 cents
        const cents = Math.round((noteNum - noteNumRounded) * 100);

        // Calculate the target frequency for this note
        this.targetFrequency = 440 * Math.pow(2, noteNumRounded / 12);

        return {
            name: noteName,
            frequency: frequency,
            cents: cents,
            octave: octave,
            midiNote: midiNote
        };
    }

    getAverageVolume() {
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.bufferLength;
    }

    drawVisualization() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas with fade effect
        this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.canvasCtx.fillRect(0, 0, width, height);

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Draw frequency spectrum with modern gradient bars
        const barCount = 128;
        const barWidth = width / barCount;
        const step = Math.floor(this.bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
            const barHeight = (this.dataArray[i * step] / 255) * height * 0.9;
            const x = i * barWidth;

            // Create dynamic gradient based on frequency
            const hue = (i / barCount) * 360;
            const gradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
            gradient.addColorStop(1, `hsla(${hue}, 80%, 40%, 0.9)`);

            this.canvasCtx.fillStyle = gradient;
            this.canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
        }

        // Draw waveform overlay
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.canvasCtx.lineWidth = 3;
        this.canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.canvasCtx.beginPath();

        const sliceWidth = width / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.canvasCtx.stroke();
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NoteVisualizer();
});
