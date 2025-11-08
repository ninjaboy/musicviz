# 🎵 Pitch Perfect - Real-time Note Visualizer

A beautiful, modern web application for real-time musical note detection with pitch correction feedback. Perfect for musicians, vocalists, and music students who want to improve their pitch accuracy.

![Pitch Perfect](https://img.shields.io/badge/pitch-perfect-success)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-native-blue)
![Mobile Friendly](https://img.shields.io/badge/mobile-friendly-brightgreen)

## ✨ Features

### 🎯 Real-time Pitch Detection
- Detects musical notes from 80Hz to 2000Hz
- FFT-based frequency analysis with 8192 sample size
- Parabolic interpolation for sub-bin accuracy
- Displays note name, octave, and exact frequency

### 📊 Pitch Accuracy Feedback
- **Visual pitch meter** showing deviation from perfect pitch (-50¢ to +50¢)
- **Animated hints** telling you whether to go higher or lower
- **Color-coded indicator** that moves along a gradient (red → yellow → green → yellow → red)
- **Real-time feedback**:
  - "Perfect! 🎯" when within ±5 cents
  - "Too Sharp - Go Lower ⬇️" when too high
  - "Too Flat - Go Higher ⬆️" when too low

### 🎤 Recording & Playback
- Record your audio directly in the browser
- Built-in recording timer
- Playback controls with start/stop functionality
- Autotune processing framework (basic implementation)

### 📱 Modern UI/UX
- **Glassmorphism design** with frosted glass effects
- **Responsive layout** that works on desktop, tablet, and mobile
- **Smooth animations** and transitions
- **Touch-friendly** controls for mobile devices
- **Dynamic visualizer** with frequency spectrum and waveform display

### 🎨 Visualization
- Real-time frequency spectrum with rainbow gradient
- Waveform overlay
- Input level meter
- Smooth animations and fade effects

## 🚀 Live Demo

**[Try it now!](https://yourusername.github.io/musicviz/)** *(coming soon)*

## 🛠️ Technology Stack

- **Web Audio API** - Native browser audio processing (no external libraries!)
- **Canvas API** - Real-time visualization
- **MediaRecorder API** - Audio recording
- **Vanilla JavaScript** - No frameworks, pure performance
- **Modern CSS** - Glassmorphism, gradients, and responsive design

## 📖 How It Works

### The Science Behind Pitch Detection

1. **Audio Input**: Microphone captures sound via `getUserMedia()`
2. **FFT Analysis**: Web Audio API's `AnalyserNode` performs Fast Fourier Transform
3. **Peak Detection**: Algorithm finds the frequency bin with highest amplitude
4. **Parabolic Interpolation**: Improves accuracy by analyzing neighboring bins
5. **Frequency to Note Conversion**: Uses the formula `n = 12 × log₂(f/440) + 69`
6. **Cents Calculation**: Measures deviation from perfect pitch (1 semitone = 100 cents)

### Understanding the Pitch Meter

The pitch meter shows your accuracy in **cents**:
- **0 cents** = Perfect pitch
- **-50 cents** = Half a semitone flat
- **+50 cents** = Half a semitone sharp
- **±100 cents** = One full semitone off

Most professional musicians aim to stay within ±5 cents of perfect pitch!

## 💻 Usage

### Getting Started

1. Open the application in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Click **"Start Listening"** and grant microphone permission
3. Sing or play a note
4. Watch the pitch meter and follow the hints!

### Recording Your Performance

1. Start listening first
2. Click **"Record & Autotune"** to begin recording
3. Sing or play your melody
4. Click **"Stop Recording"** when done
5. Click **"Play Recording"** to hear your performance

### Tips for Best Results

- Use in a quiet environment for better accuracy
- Sing or play sustained notes for clearest detection
- Adjust your microphone input level if needed
- The louder and clearer the note, the better the detection

## 🔧 Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/musicviz.git
cd musicviz

# Start a local server (Python 3)
python3 -m http.server 5500

# Or use any other local server
# npx serve
# php -S localhost:5500
```

Then open `http://localhost:5500` in your browser.

## 📁 Project Structure

```
musicviz/
├── index.html          # Main HTML with modern UI
├── visualizer.js       # Core application logic
├── README.md           # This file
└── .gitignore         # Git ignore rules
```

## 🎓 Educational Value

This project demonstrates:
- **Signal Processing**: FFT, frequency analysis, pitch detection
- **Music Theory**: Note frequencies, cents, octaves, MIDI notes
- **Web Audio API**: Advanced browser audio capabilities
- **Responsive Design**: Mobile-first, accessible UI
- **Modern JavaScript**: ES6+, async/await, classes

## 🤝 Contributing

Contributions are welcome! Here are some ideas for enhancements:

- [ ] Implement advanced autotune with real pitch shifting
- [ ] Add scale/key selection for practicing
- [ ] Save and export recordings
- [ ] Add tuning reference adjustment (A4 = 440Hz configurable)
- [ ] Support for different tuning systems (equal temperament, just intonation)
- [ ] Chord detection
- [ ] Practice mode with target notes

## 📝 License

MIT License - feel free to use this project for learning, teaching, or building your own tools!

## 🙏 Credits

Built with passion for music and technology.

### Technologies Used
- Web Audio API - [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- FFT (Fast Fourier Transform) - The magic behind frequency analysis
- Musical pitch mathematics - Based on equal temperament tuning system

## 🐛 Known Limitations

- Autotune feature is currently basic (records and plays back without real-time pitch shifting)
- Works best with monophonic (single note) inputs
- Polyphonic detection (chords) not yet supported
- Requires HTTPS or localhost for microphone access

## 📮 Feedback

Found a bug or have a suggestion? Please open an issue on GitHub!

---

**Made with ❤️ for musicians everywhere**
