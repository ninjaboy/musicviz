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

        // Canvas setup
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');

        // Timeline canvas
        this.timelineCanvas = document.getElementById('timeline');
        this.timelineCtx = this.timelineCanvas.getContext('2d');

        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.noteNameElement = document.getElementById('noteName');
        this.frequencyElement = document.getElementById('frequency');
        this.volumeFill = document.getElementById('volumeFill');
        this.volumePercent = document.getElementById('volumePercent');
        this.pitchIndicator = document.getElementById('pitchIndicator');
        this.pitchHint = document.getElementById('pitchHint');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.messageElement = document.getElementById('message');

        // Note history tracking
        this.noteHistory = [];
        this.historyStartTime = null;
        this.maxHistoryDuration = 10; // seconds

        // Note frequencies (A4 = 440Hz standard)
        this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        // Current note info
        this.currentCents = 0;
        this.targetFrequency = 0;

        // Reference tone playback
        this.referenceOscillator = null;
        this.referenceGain = null;
        this.currentOctave = 4;
        this.currentlyPlayingBtn = null;

        this.setupEventListeners();
        this.generateNoteButtons();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.toggleMicrophone());
        this.recordBtn.addEventListener('click', () => this.toggleRecording());

        // Octave selector
        document.querySelectorAll('.octave-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.octave-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentOctave = parseInt(e.target.dataset.octave);
                this.generateNoteButtons();
            });
        });
    }

    generateNoteButtons() {
        const container = document.getElementById('noteButtons');
        container.innerHTML = '';

        this.noteStrings.forEach((note, index) => {
            const btn = document.createElement('button');
            btn.className = 'note-btn';
            btn.textContent = note;
            btn.dataset.note = note;
            btn.dataset.midiNote = (this.currentOctave + 1) * 12 + index;

            btn.addEventListener('click', () => this.playReferenceNote(btn));

            container.appendChild(btn);
        });
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

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `pitch-recording-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        this.showMessage('✓ Recording saved!', 'success');
        this.recordingStatus.textContent = '';
    }

    playReferenceNote(btn) {
        // Stop any currently playing reference note
        this.stopReferenceNote();

        // Create audio context if needed
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Get MIDI note number and calculate frequency
        const midiNote = parseInt(btn.dataset.midiNote);
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

        // Create oscillator for the tone
        this.referenceOscillator = this.audioContext.createOscillator();
        this.referenceGain = this.audioContext.createGain();

        // Set up the tone
        this.referenceOscillator.type = 'sine'; // Pure sine wave for reference
        this.referenceOscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        // Set up volume with fade in/out
        this.referenceGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.referenceGain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05); // Fade in
        this.referenceGain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 1.95); // Sustain
        this.referenceGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 2); // Fade out

        // Connect nodes
        this.referenceOscillator.connect(this.referenceGain);
        this.referenceGain.connect(this.audioContext.destination);

        // Play the tone
        this.referenceOscillator.start(this.audioContext.currentTime);
        this.referenceOscillator.stop(this.audioContext.currentTime + 2);

        // Update UI
        btn.classList.add('playing');
        this.currentlyPlayingBtn = btn;

        // Clean up after tone finishes
        this.referenceOscillator.onended = () => {
            if (this.currentlyPlayingBtn) {
                this.currentlyPlayingBtn.classList.remove('playing');
                this.currentlyPlayingBtn = null;
            }
            this.referenceOscillator = null;
            this.referenceGain = null;
        };

        // Show feedback
        const noteName = btn.dataset.note + this.currentOctave;
        this.showMessage(`Playing reference note: ${noteName} (${frequency.toFixed(2)} Hz)`, 'success');
    }

    stopReferenceNote() {
        if (this.referenceOscillator) {
            try {
                this.referenceOscillator.stop();
            } catch (e) {
                // Already stopped
            }
            this.referenceOscillator = null;
        }

        if (this.referenceGain) {
            this.referenceGain = null;
        }

        if (this.currentlyPlayingBtn) {
            this.currentlyPlayingBtn.classList.remove('playing');
            this.currentlyPlayingBtn = null;
        }
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

            // Track note in history
            this.addNoteToHistory(note, frequency, volume);

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

        // Draw timeline
        this.drawTimeline();

        // Continue analyzing
        requestAnimationFrame(() => this.analyze());
    }

    updatePitchDeviation(cents) {
        this.currentCents = cents;

        // Move indicator (-50 to +50 cents maps to 0% to 100%)
        const position = 50 + cents; // 0-100 range
        this.pitchIndicator.style.left = `${position}%`;

        // Update hint text and color with cyberpunk style
        if (Math.abs(cents) < 5) {
            this.pitchHint.innerHTML = '<span class="perfect">[ LOCKED ] PITCH PERFECT</span>';
        } else if (cents > 5) {
            const arrow = cents > 20 ? '⬇⬇' : '⬇';
            this.pitchHint.innerHTML = `<span class="arrow down">${arrow}</span> <span style="color: #ffaa00">TOO SHARP &gt;&gt; LOWER</span>`;
        } else {
            const arrow = cents < -20 ? '⬆⬆' : '⬆';
            this.pitchHint.innerHTML = `<span class="arrow up">${arrow}</span> <span style="color: #ffaa00">TOO FLAT &gt;&gt; HIGHER</span>`;
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

        // Calculate how close we are to the perfect pitch (in cents)
        // 1 semitone = 100 cents
        const cents = Math.round((noteNum - noteNumRounded) * 100);

        // Get note name - mark as "OTHER" if too far from standard pitch
        let noteName;
        let octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;

        if (Math.abs(cents) > 35) {
            // Too far from standard pitch - non-musical or noise
            noteName = 'OTHER';
        } else {
            noteName = this.noteStrings[noteIndex] + octave;
        }

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

    addNoteToHistory(note, frequency, volume) {
        const now = Date.now();

        // Initialize history start time
        if (!this.historyStartTime) {
            this.historyStartTime = now;
        }

        const timestamp = (now - this.historyStartTime) / 1000; // Convert to seconds

        // Add note to history
        this.noteHistory.push({
            note: note.name,
            frequency: frequency,
            cents: note.cents,
            volume: volume,
            timestamp: timestamp
        });

        // Remove old notes beyond max duration
        this.noteHistory = this.noteHistory.filter(
            item => timestamp - item.timestamp < this.maxHistoryDuration
        );

        // Update timeline labels
        const end = timestamp;
        const start = Math.max(0, end - this.maxHistoryDuration);
        document.getElementById('timelineStart').textContent = `${start.toFixed(1)}s`;
        document.getElementById('timelineEnd').textContent = `${end.toFixed(1)}s`;
    }

    drawTimeline() {
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;

        // Clear canvas
        this.timelineCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.timelineCtx.fillRect(0, 0, width, height);

        if (this.noteHistory.length === 0) return;

        const now = Date.now();
        const currentTime = (now - this.historyStartTime) / 1000;
        const startTime = Math.max(0, currentTime - this.maxHistoryDuration);

        // Draw notes
        this.noteHistory.forEach((item, index) => {
            const x = ((item.timestamp - startTime) / this.maxHistoryDuration) * width;
            const noteHeight = 20;
            const y = height / 2 - noteHeight / 2;

            // Color based on note type
            let color;
            if (item.note === 'OTHER') {
                color = 'rgba(255, 170, 0, 0.6)'; // Orange for other
            } else if (Math.abs(item.cents) < 5) {
                color = 'rgba(0, 255, 255, 0.8)'; // Cyan for perfect
            } else {
                color = 'rgba(0, 255, 65, 0.6)'; // Green for standard notes
            }

            // Draw note block
            this.timelineCtx.fillStyle = color;
            this.timelineCtx.fillRect(x, y, 3, noteHeight);

            // Add glow effect
            if (index === this.noteHistory.length - 1) {
                this.timelineCtx.shadowColor = color;
                this.timelineCtx.shadowBlur = 10;
                this.timelineCtx.fillRect(x, y, 3, noteHeight);
                this.timelineCtx.shadowBlur = 0;
            }

            // Draw note label occasionally
            if (index % 30 === 0 && item.note !== 'OTHER') {
                this.timelineCtx.fillStyle = 'rgba(0, 255, 65, 0.9)';
                this.timelineCtx.font = '10px "Share Tech Mono", monospace';
                this.timelineCtx.fillText(item.note, x, y - 5);
            }
        });

        // Draw current time indicator
        this.timelineCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        this.timelineCtx.lineWidth = 2;
        this.timelineCtx.beginPath();
        this.timelineCtx.moveTo(width - 2, 0);
        this.timelineCtx.lineTo(width - 2, height);
        this.timelineCtx.stroke();
    }

    drawVisualization() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas with darker fade for matrix effect
        this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.canvasCtx.fillRect(0, 0, width, height);

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Draw frequency spectrum with matrix-style green bars
        const barCount = 128;
        const barWidth = width / barCount;
        const step = Math.floor(this.bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
            const barHeight = (this.dataArray[i * step] / 255) * height * 0.85;
            const x = i * barWidth;

            // Matrix green gradient with intensity based on amplitude
            const intensity = this.dataArray[i * step] / 255;
            const gradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height);

            // Cyberpunk green/cyan gradient
            gradient.addColorStop(0, `rgba(0, 255, 255, ${intensity * 0.9})`); // Cyan top
            gradient.addColorStop(0.5, `rgba(0, 255, 65, ${intensity * 0.8})`); // Matrix green
            gradient.addColorStop(1, `rgba(0, 170, 46, ${intensity * 0.7})`); // Dim green

            this.canvasCtx.fillStyle = gradient;
            this.canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

            // Add glow effect on peaks
            if (barHeight > height * 0.6) {
                this.canvasCtx.shadowColor = 'rgba(0, 255, 65, 0.8)';
                this.canvasCtx.shadowBlur = 10;
                this.canvasCtx.fillRect(x, height - barHeight, barWidth - 1, 3);
                this.canvasCtx.shadowBlur = 0;
            }
        }

        // Draw waveform overlay with matrix green
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; // Cyan waveform
        this.canvasCtx.shadowColor = 'rgba(0, 255, 255, 0.5)';
        this.canvasCtx.shadowBlur = 5;
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
        this.canvasCtx.shadowBlur = 0;
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NoteVisualizer();
});
