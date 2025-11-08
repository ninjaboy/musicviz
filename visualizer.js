// Musical Note Visualizer with Pitch Detection and Autotune

class NoteVisualizer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isRunning = false;

        // Canvas setup
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');

        // Timeline canvas
        this.timelineCanvas = document.getElementById('timeline');
        this.timelineCtx = this.timelineCanvas.getContext('2d');

        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.noteNameElement = document.getElementById('noteName');
        this.frequencyElement = document.getElementById('frequency');
        this.pitchIndicator = document.getElementById('pitchIndicator');
        this.pitchHint = document.getElementById('pitchHint');
        this.messageElement = document.getElementById('message');
        this.latencyElement = document.getElementById('latency');

        // Note history tracking
        this.noteHistory = [];
        this.historyStartTime = null;
        this.maxHistoryDuration = 10; // seconds

        // Waveform history for timeline visualization
        this.waveformHistory = [];

        // Active notes tracking (for Y-axis highlighting)
        this.activeNotes = new Set(); // Currently playing MIDI notes
        this.allDetectedNotes = new Set(); // All notes ever detected

        // Chord detection
        this.detectedChords = [];
        this.lastChordTime = 0;
        this.chordListElement = document.getElementById('chordList');

        // Note frequencies (A4 = 440Hz standard)
        this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        // Current note info
        this.currentCents = 0;
        this.targetFrequency = 0;

        // Temporal smoothing for stability
        this.smoothingBuffer = [];
        this.smoothingBufferSize = 5; // Average over last 5 frames
        this.lastProcessTime = 0;
        this.processingLatency = 0;

        // Reference tone playback
        this.referenceOscillator = null;
        this.referenceGain = null;
        this.currentOctave = 4;
        this.currentlyPlayingBtn = null;

        this.setupEventListeners();
        this.generateNoteButtons();

        // Console banner
        console.log('%c🎵 PITCH.ANALYZER v1.0.4', 'color: #00ff41; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #00ff41;');
        console.log('%cMulti-frequency detection • Harmonic filtering • Real-time analysis', 'color: #00ffff; font-size: 12px;');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00ff41;');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.toggleMicrophone());

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

            this.showMessage('Microphone active! Start singing or playing.', 'success');

            console.log('%c▶ Analysis started', 'color: #00ff41; font-weight: bold;');
            console.log(`  Sample Rate: ${this.audioContext.sampleRate}Hz`);
            console.log(`  FFT Size: ${this.analyser.fftSize}`);
            console.log(`  Frequency Resolution: ${(this.audioContext.sampleRate / this.analyser.fftSize).toFixed(2)}Hz/bin`);
            console.log(`  Smoothing: ${this.smoothingBufferSize} frames`);

            // Start the analysis loop
            this.analyze();

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showMessage('Could not access microphone. Please grant permission.', 'error');
        }
    }

    stop() {
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
        this.noteNameElement.textContent = '--';
        this.frequencyElement.textContent = '-- Hz';
        this.pitchHint.innerHTML = '';
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

        const startTime = performance.now();

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Get volume level for tracking
        const volume = this.getAverageVolume();
        const volumePercent = (volume / 255) * 100;

        // Detect all frequencies (multi-note detection)
        const detectedFrequencies = this.detectPitch();

        if (detectedFrequencies.length > 0) {
            // Convert all frequencies to notes
            const notes = detectedFrequencies.map(f => ({
                ...this.frequencyToNote(f.frequency),
                amplitude: f.amplitude,
                confidence: f.confidence || 1.0
            }));

            // Display all detected notes
            const noteNames = notes.map(n => n.name).join(' ');
            this.noteNameElement.textContent = noteNames;

            // Show frequency of loudest note
            const primaryNote = notes[0];
            const freqText = detectedFrequencies.map(f => f.frequency.toFixed(1)).join(' ');
            this.frequencyElement.textContent = `${freqText} Hz`;

            // Update active notes
            this.activeNotes.clear();
            notes.forEach(note => {
                this.activeNotes.add(note.midiNote);
                this.allDetectedNotes.add(note.midiNote);
            });

            // Detect chords (3+ notes)
            if (notes.length >= 3) {
                this.detectChord(notes);
            }

            // Console logging for debugging
            console.log(`%c🎵 ${noteNames}`, 'color: #00ff41; font-weight: bold;',
                `| ${detectedFrequencies.map(f => f.frequency.toFixed(2) + 'Hz').join(', ')}`,
                `| Cents: ${primaryNote.cents > 0 ? '+' : ''}${primaryNote.cents}`,
                `| Vol: ${Math.round(volumePercent)}%`,
                `| Latency: ${this.processingLatency.toFixed(1)}ms`
            );

            // Track all notes in history
            notes.forEach(note => {
                this.addNoteToHistory(note, note.frequency, volume);
            });

            // Update pitch deviation based on loudest note
            this.updatePitchDeviation(primaryNote.cents);

            // Animate note display based on volume
            const scale = 1 + (volume / 255) * 0.2;
            this.noteNameElement.style.transform = `scale(${scale})`;
        } else {
            // Clear active notes
            this.activeNotes.clear();

            // Show dashes when no note detected but keep volume meter active
            this.noteNameElement.textContent = '--';
            this.frequencyElement.textContent = '-- Hz';
            this.pitchHint.innerHTML = '';
            this.pitchIndicator.style.left = '50%';
        }

        // Track waveform for timeline
        this.trackWaveform(volume);

        // Calculate and display latency
        const endTime = performance.now();
        this.processingLatency = endTime - startTime;
        if (this.latencyElement) {
            this.latencyElement.textContent = `${this.processingLatency.toFixed(1)}ms`;
        }

        // Draw visualization
        this.drawVisualization();

        // Draw timeline with waveform
        this.drawTimeline();

        // Continue analyzing
        requestAnimationFrame(() => this.analyze());
    }

    trackWaveform(volume) {
        const now = Date.now();

        if (!this.historyStartTime) {
            this.historyStartTime = now;
        }

        const timestamp = (now - this.historyStartTime) / 1000;

        this.waveformHistory.push({
            timestamp: timestamp,
            amplitude: volume
        });

        // Remove old waveform data
        this.waveformHistory = this.waveformHistory.filter(
            item => timestamp - item.timestamp < this.maxHistoryDuration
        );
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
        // Multi-frequency detection with harmonic filtering
        const frequencies = this.detectAllFrequencies();

        if (frequencies.length === 0) {
            return [];
        }

        // Apply temporal smoothing
        this.smoothingBuffer.push(frequencies);
        if (this.smoothingBuffer.length > this.smoothingBufferSize) {
            this.smoothingBuffer.shift();
        }

        // Average frequencies across buffer
        return this.smoothFrequencies();
    }

    detectAllFrequencies() {
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        const nyquist = this.audioContext.sampleRate / 2;
        const minFreq = 80;
        const maxFreq = 2000;
        const minIndex = Math.floor(minFreq / nyquist * this.bufferLength);
        const maxIndexBound = Math.floor(maxFreq / nyquist * this.bufferLength);

        // Find all peaks
        const peaks = [];
        const threshold = 20; // Minimum amplitude
        const peakWindow = 5; // Look for local maxima within this window

        for (let i = minIndex + peakWindow; i < maxIndexBound - peakWindow; i++) {
            const value = this.dataArray[i];

            if (value < threshold) continue;

            // Check if this is a local maximum
            let isLocalMax = true;
            for (let j = i - peakWindow; j <= i + peakWindow; j++) {
                if (j !== i && this.dataArray[j] >= value) {
                    isLocalMax = false;
                    break;
                }
            }

            if (isLocalMax) {
                // Apply parabolic interpolation
                let frequency = i * nyquist / this.bufferLength;

                if (i > 0 && i < this.bufferLength - 1) {
                    const y1 = this.dataArray[i - 1];
                    const y2 = this.dataArray[i];
                    const y3 = this.dataArray[i + 1];

                    if (2 * y2 - y1 - y3 !== 0) {
                        const delta = 0.5 * (y3 - y1) / (2 * y2 - y1 - y3);
                        frequency = (i + delta) * nyquist / this.bufferLength;
                    }
                }

                peaks.push({
                    frequency: frequency,
                    amplitude: value,
                    index: i
                });
            }
        }

        // Sort by amplitude (loudest first)
        peaks.sort((a, b) => b.amplitude - a.amplitude);

        // Filter out harmonics - keep only fundamentals
        const fundamentals = [];
        for (let i = 0; i < peaks.length; i++) {
            const peak = peaks[i];
            let isHarmonic = false;

            // Check if this frequency is a harmonic of any louder peak
            for (let j = 0; j < fundamentals.length; j++) {
                const fundamental = fundamentals[j];

                // Check if peak is approximately an integer multiple of fundamental
                const ratio = peak.frequency / fundamental.frequency;
                const nearestHarmonic = Math.round(ratio);

                // If ratio is close to an integer (within 5%), it's likely a harmonic
                if (nearestHarmonic >= 2 && Math.abs(ratio - nearestHarmonic) < 0.1) {
                    isHarmonic = true;
                    console.log(`%c  ⚠️ Filtered harmonic: ${peak.frequency.toFixed(2)}Hz (${nearestHarmonic}x of ${fundamental.frequency.toFixed(2)}Hz)`,
                        'color: #ffaa00; font-size: 10px;');
                    break;
                }
            }

            if (!isHarmonic) {
                fundamentals.push(peak);
            }

            // Limit to top 5 fundamentals
            if (fundamentals.length >= 5) break;
        }

        if (fundamentals.length > 0) {
            console.log(`%c  ✓ Found ${fundamentals.length} fundamental(s) from ${peaks.length} peak(s)`,
                'color: #00ffff; font-size: 10px;');
        }

        return fundamentals;
    }

    smoothFrequencies() {
        // Average detected frequencies across the smoothing buffer
        if (this.smoothingBuffer.length === 0) return [];

        // Build frequency map
        const frequencyMap = new Map();

        this.smoothingBuffer.forEach(frameFreqs => {
            frameFreqs.forEach(peak => {
                // Round to nearest note for grouping
                const noteNum = 12 * (Math.log(peak.frequency / 440) / Math.log(2));
                const roundedNote = Math.round(noteNum);

                if (!frequencyMap.has(roundedNote)) {
                    frequencyMap.set(roundedNote, []);
                }
                frequencyMap.get(roundedNote).push(peak);
            });
        });

        // Average each note group
        const smoothed = [];
        frequencyMap.forEach((peaks, noteNum) => {
            const avgFreq = peaks.reduce((sum, p) => sum + p.frequency, 0) / peaks.length;
            const avgAmp = peaks.reduce((sum, p) => sum + p.amplitude, 0) / peaks.length;

            smoothed.push({
                frequency: avgFreq,
                amplitude: avgAmp,
                confidence: peaks.length / this.smoothingBufferSize
            });
        });

        // Sort by amplitude
        smoothed.sort((a, b) => b.amplitude - a.amplitude);

        return smoothed;
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

        // Get note name
        let octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        const noteName = this.noteStrings[noteIndex] + octave;

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
            timestamp: timestamp,
            midiNote: note.midiNote
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
        this.timelineCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.timelineCtx.fillRect(0, 0, width, height);

        if (this.noteHistory.length === 0) return;

        const now = Date.now();
        const currentTime = (now - this.historyStartTime) / 1000;
        const startTime = Math.max(0, currentTime - this.maxHistoryDuration);

        // Define note range for piano roll (C3 to C6 = 36 semitones)
        const minMidi = 48; // C3
        const maxMidi = 84; // C6
        const midiRange = maxMidi - minMidi;

        // Draw Y-axis with all detected notes
        const yAxisWidth = 35;
        const sortedDetectedNotes = Array.from(this.allDetectedNotes).sort((a, b) => a - b);

        // Draw background for Y-axis
        this.timelineCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.timelineCtx.fillRect(0, 0, yAxisWidth, height);

        // Draw horizontal grid lines for all detected notes
        sortedDetectedNotes.forEach(midiNote => {
            if (midiNote < minMidi || midiNote > maxMidi) return;

            const y = height - ((midiNote - minMidi) / midiRange) * height;
            const noteName = this.midiToNoteName(midiNote);
            const isActive = this.activeNotes.has(midiNote);

            // Grid line
            this.timelineCtx.strokeStyle = isActive ?
                'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 65, 0.08)';
            this.timelineCtx.lineWidth = isActive ? 2 : 1;
            this.timelineCtx.beginPath();
            this.timelineCtx.moveTo(yAxisWidth, y);
            this.timelineCtx.lineTo(width, y);
            this.timelineCtx.stroke();

            // Note label
            this.timelineCtx.fillStyle = isActive ?
                'rgba(0, 255, 255, 1.0)' : 'rgba(0, 255, 65, 0.5)';
            this.timelineCtx.font = isActive ?
                'bold 10px "Share Tech Mono", monospace' :
                '9px "Share Tech Mono", monospace';

            // Add glow for active notes
            if (isActive) {
                this.timelineCtx.shadowColor = 'rgba(0, 255, 255, 0.8)';
                this.timelineCtx.shadowBlur = 8;
            }

            this.timelineCtx.fillText(noteName, 3, y + 3);
            this.timelineCtx.shadowBlur = 0;
        });

        // Draw Y-axis border
        this.timelineCtx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
        this.timelineCtx.lineWidth = 1;
        this.timelineCtx.beginPath();
        this.timelineCtx.moveTo(yAxisWidth, 0);
        this.timelineCtx.lineTo(yAxisWidth, height);
        this.timelineCtx.stroke();

        // Group consecutive notes into horizontal bars (piano roll style)
        const noteGroups = new Map(); // Map of "midiNote" -> array of time segments

        this.noteHistory.forEach((item, index) => {
            const midiNote = item.midiNote || this.noteToMidi(item.note);

            if (!noteGroups.has(midiNote)) {
                noteGroups.set(midiNote, []);
            }

            // Check if this continues the previous note
            const groups = noteGroups.get(midiNote);
            const lastGroup = groups[groups.length - 1];

            if (lastGroup && item.timestamp - lastGroup.endTime < 0.15) {
                // Continue existing group
                lastGroup.endTime = item.timestamp;
                lastGroup.cents = item.cents; // Update cents
            } else {
                // Start new group
                groups.push({
                    startTime: item.timestamp,
                    endTime: item.timestamp,
                    note: item.note,
                    cents: item.cents,
                    midiNote: midiNote
                });
            }
        });

        // Draw note bars
        noteGroups.forEach((groups, midiNote) => {
            groups.forEach(group => {
                if (midiNote < minMidi || midiNote > maxMidi) return;

                const x1 = yAxisWidth + ((group.startTime - startTime) / this.maxHistoryDuration) * (width - yAxisWidth);
                const x2 = yAxisWidth + ((group.endTime - startTime) / this.maxHistoryDuration) * (width - yAxisWidth);
                const barWidth = Math.max(x2 - x1, 3); // Minimum 3px width

                // Calculate Y position (piano roll style)
                const y = height - ((midiNote - minMidi) / midiRange) * height;
                const barHeight = Math.max(height / midiRange * 0.8, 3);

                // Color based on pitch accuracy
                let color;
                if (Math.abs(group.cents) < 5) {
                    color = 'rgba(0, 255, 255, 0.9)'; // Cyan for perfect
                } else if (Math.abs(group.cents) < 15) {
                    color = 'rgba(0, 255, 65, 0.8)'; // Green for close
                } else {
                    color = 'rgba(255, 170, 0, 0.7)'; // Orange for off-pitch
                }

                // Draw note bar
                this.timelineCtx.fillStyle = color;
                this.timelineCtx.fillRect(x1, y - barHeight / 2, barWidth, barHeight);

                // Add border
                this.timelineCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                this.timelineCtx.lineWidth = 1;
                this.timelineCtx.strokeRect(x1, y - barHeight / 2, barWidth, barHeight);

                // Add glow for perfect pitch
                if (Math.abs(group.cents) < 5 && barWidth > 10) {
                    this.timelineCtx.shadowColor = color;
                    this.timelineCtx.shadowBlur = 8;
                    this.timelineCtx.fillStyle = color;
                    this.timelineCtx.fillRect(x1, y - barHeight / 2, barWidth, barHeight);
                    this.timelineCtx.shadowBlur = 0;
                }

                // Draw note label if bar is wide enough
                if (barWidth > 25) {
                    this.timelineCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    this.timelineCtx.font = '9px "Share Tech Mono", monospace';
                    this.timelineCtx.fillText(group.note, x1 + 3, y + 3);
                }
            });
        });

        // Draw current time indicator
        this.timelineCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        this.timelineCtx.lineWidth = 2;
        this.timelineCtx.setLineDash([5, 5]);
        this.timelineCtx.beginPath();
        this.timelineCtx.moveTo(width - 2, 0);
        this.timelineCtx.lineTo(width - 2, height);
        this.timelineCtx.stroke();
        this.timelineCtx.setLineDash([]);
    }

    noteToMidi(noteName) {
        // Extract note and octave from string like "C4" or "F#5"
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 60; // Default to C4

        const note = match[1];
        const octave = parseInt(match[2]);

        const noteIndex = this.noteStrings.indexOf(note);
        if (noteIndex === -1) return 60;

        return (octave + 1) * 12 + noteIndex;
    }

    midiToNoteName(midiNote) {
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        return this.noteStrings[noteIndex] + octave;
    }

    detectChord(notes) {
        // Only detect chords every 500ms to avoid spam
        const now = Date.now();
        if (now - this.lastChordTime < 500) return;

        // Sort by pitch
        const sortedNotes = [...notes].sort((a, b) => a.midiNote - b.midiNote);
        const noteNames = sortedNotes.map(n => n.name.replace(/\d+/, '')); // Remove octave
        const intervals = [];

        // Calculate intervals from root
        for (let i = 1; i < sortedNotes.length; i++) {
            intervals.push((sortedNotes[i].midiNote - sortedNotes[0].midiNote) % 12);
        }

        const chordName = this.identifyChord(sortedNotes[0].name, intervals, noteNames);

        if (chordName) {
            this.lastChordTime = now;

            // Add to chord list if not duplicate
            const lastChord = this.detectedChords[this.detectedChords.length - 1];
            if (!lastChord || lastChord.name !== chordName) {
                this.detectedChords.push({
                    name: chordName,
                    notes: sortedNotes.map(n => n.name),
                    timestamp: (now - this.historyStartTime) / 1000
                });

                // Update chord list UI
                this.updateChordList();

                console.log(`%c🎸 Chord: ${chordName}`, 'color: #00ffff; font-weight: bold; font-size: 14px;',
                    `| Notes: ${sortedNotes.map(n => n.name).join(' ')}`);
            }
        }
    }

    identifyChord(root, intervals, noteNames) {
        const intervalsStr = intervals.join(',');

        // Major chords
        if (intervalsStr === '4,7') return `${root} Major`;
        if (intervalsStr === '4,7,11') return `${root} Major 7`;
        if (intervalsStr === '4,7,10') return `${root} Dominant 7`;

        // Minor chords
        if (intervalsStr === '3,7') return `${root} Minor`;
        if (intervalsStr === '3,7,10') return `${root} Minor 7`;
        if (intervalsStr === '3,7,11') return `${root} Minor Major 7`;

        // Diminished & Augmented
        if (intervalsStr === '3,6') return `${root} Diminished`;
        if (intervalsStr === '3,6,9') return `${root} Diminished 7`;
        if (intervalsStr === '4,8') return `${root} Augmented`;

        // Sus chords
        if (intervalsStr === '2,7') return `${root} Sus2`;
        if (intervalsStr === '5,7') return `${root} Sus4`;

        // Extended chords
        if (intervalsStr === '4,7,10,2') return `${root} 9`;
        if (intervalsStr === '3,7,10,2') return `${root} Minor 9`;

        // Power chord (no third)
        if (intervalsStr === '7') return `${root}5 (Power)`;

        // Generic
        return `${root} Chord (${noteNames.join(' ')})`;
    }

    updateChordList() {
        if (!this.chordListElement) return;

        // Show last 10 chords
        const recentChords = this.detectedChords.slice(-10).reverse();

        this.chordListElement.innerHTML = recentChords.map(chord =>
            `<div class="chord-item">
                <span class="chord-name">${chord.name}</span>
                <span class="chord-notes">${chord.notes.join(' ')}</span>
            </div>`
        ).join('');
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
