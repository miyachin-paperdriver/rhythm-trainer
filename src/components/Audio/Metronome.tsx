import React, { useState, useEffect } from 'react';
import { RippleButton } from '../Controls/RippleButton';
import { useTranslation } from 'react-i18next';
import { useMetronome } from '../../hooks/useMetronome';
import { useAudioAnalysis } from '../../hooks/useAudioAnalysis';
import { useRhythmScoring } from '../../hooks/useRhythmScoring';
import { useSessionManager } from '../../hooks/useSessionManager';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useInternalMicSelection } from '../../hooks/useInternalMicSelection';
import { MetronomeSettings } from '../Controls/MetronomeSettings';
import { SubdivisionControl } from '../Controls/SubdivisionControl';
import { GapClickControl } from '../Controls/GapClickControl';
import { type Subdivision } from './MetronomeEngine';
import { PatternVisualizer } from '../Visualizer/PatternVisualizer';
import { WaveformVisualizer } from '../Audio/WaveformVisualizer';
import { HistoryView } from '../Analysis/HistoryView';
import { TimingGauge } from '../Visualizer/TimingGauge';
import { TimingDeviationGraph } from '../Analysis/TimingDeviationGraph';
import { ManualHelper } from '../Manual/ManualHelper';
import { PatternManager } from '../Editor/PatternManager';
import { VisualEffectsOverlay } from '../Visualizer/VisualEffectsOverlay';
import { PATTERNS, measuresToSequence, expandPattern, patternToMeasures, type Note } from '../../utils/patterns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export const Metronome: React.FC = () => {
    const { t, i18n } = useTranslation();
    // ---- State ----
    const [activeTab, setActiveTab] = useState<'training' | 'history' | 'editor' | 'manual' | 'settings'>(() => {
        const hasLaunched = localStorage.getItem('hasLaunched');
        if (!hasLaunched) {
            localStorage.setItem('hasLaunched', 'true');
            return 'manual';
        }
        return 'training';
    });



    // Custom Patterns from DB
    const customPatterns = useLiveQuery(() => db.custom_patterns.toArray(), []) || [];

    // Merge Presets & Custom
    // Note: We need a unified list. Custom patterns use number IDs, presets use string IDs.
    // All patterns now have 'measures' for consistent handling.
    const allPatterns = React.useMemo(() => {
        const presets = PATTERNS.map(p => ({
            id: p.id,
            name: p.name,
            sequence: p.sequence as Note[], // For display compatibility
            measures: patternToMeasures(p, 1), // Convert to measures format (quarter notes)
            isCustom: false
        }));
        const customs = customPatterns.map(cp => ({
            id: String(cp.id), // Ensure string ID for <select>
            name: cp.name,
            sequence: measuresToSequence(cp.measures),
            measures: cp.measures,
            isCustom: true
        }));
        return [...presets, ...customs];
    }, [customPatterns]);

    const [selectedPatternId, setSelectedPatternId] = useState(PATTERNS[2].id);

    // Find pattern in combined list
    const selectedPattern = allPatterns.find(p => p.id === String(selectedPatternId)) || allPatterns[0];

    // Get expanded measures for ALL patterns (unified logic)
    const expandedMeasures = React.useMemo(() => {
        if (!selectedPattern.measures) return null;
        return expandPattern(selectedPattern.measures);
    }, [selectedPattern]);

    const [disableRecording, setDisableRecording] = useState(false);
    const [editorIsDirty, setEditorIsDirty] = useState(false);

    // タブ変更（未保存確認付き）
    const handleTabChange = (tab: typeof activeTab) => {
        if (activeTab === 'editor' && editorIsDirty) {
            if (!confirm('保存されていない変更があります。破棄しますか？')) {
                return;
            }
            setEditorIsDirty(false);
        }
        setActiveTab(tab);
    };


    // Tempo / Rhythm Settings State
    const [subdivision, setSubdivisionState] = useState<Subdivision>(1);
    const [gapEnabled, setGapEnabled] = useState(false);
    const [playBars, setPlayBars] = useState(4);
    const [muteBars, setMuteBars] = useState(4);
    // const [tapTempo, setTapTempo] = useState<number[]>([]); // Removed unused

    // Output Mode State
    const [outputMode, setOutputMode] = useState<'speaker' | 'headphone'>(() => {
        const saved = localStorage.getItem('rhythm-trainer-output-mode');
        return (saved === 'speaker' || saved === 'headphone') ? saved : 'speaker';
    });

    // Load/Save Settings
    useEffect(() => {
        localStorage.setItem('rhythm-trainer-output-mode', outputMode);
    }, [outputMode]);

    // Audio Context State
    // const [audioContextState, setAudioContextState] = useState<'suspended' | 'running' | 'closed'>('suspended'); // Removed shadowing

    // Latency State (Independent)
    const [audioLatencySpeaker, setAudioLatencySpeaker] = useState(() => Number(localStorage.getItem('audioLatency_speaker') || 0));
    const [audioLatencyBT, setAudioLatencyBT] = useState(() => Number(localStorage.getItem('audioLatency_bt') || 200));

    // Mic Settings State (Independent)
    const [micGainSpeaker, setMicGainSpeaker] = useState(() => Number(localStorage.getItem('micGain_speaker') || 7.0));
    const [micGainBT, setMicGainBT] = useState(() => Number(localStorage.getItem('micGain_bt') || 10.0)); // Higher default for BT

    const [micThresholdSpeaker, setMicThresholdSpeaker] = useState(() => Number(localStorage.getItem('micThreshold_speaker') || 0.1));
    const [micThresholdBT, setMicThresholdBT] = useState(() => Number(localStorage.getItem('micThreshold_bt') || 0.15));

    // Derived Current Settings
    const audioLatency = outputMode === 'speaker' ? audioLatencySpeaker : audioLatencyBT;
    const micGain = outputMode === 'speaker' ? micGainSpeaker : micGainBT;
    const micThreshold = outputMode === 'speaker' ? micThresholdSpeaker : micThresholdBT;

    // Setters that update the correct state based on current mode
    const setAudioLatency = (val: number) => {
        if (outputMode === 'speaker') {
            setAudioLatencySpeaker(val);
            localStorage.setItem('audioLatency_speaker', String(val));
        } else {
            setAudioLatencyBT(val);
            localStorage.setItem('audioLatency_bt', String(val));
        }
    };

    const setMicGain = (val: number) => {
        if (outputMode === 'speaker') {
            setMicGainSpeaker(val);
            localStorage.setItem('micGain_speaker', String(val));
        } else {
            setMicGainBT(val);
            localStorage.setItem('micGain_bt', String(val));
        }
    };

    const setMicThreshold = (val: number) => {
        if (outputMode === 'speaker') {
            setMicThresholdSpeaker(val);
            localStorage.setItem('micThreshold_speaker', String(val));
        } else {
            setMicThresholdBT(val);
            localStorage.setItem('micThreshold_bt', String(val));
        }
    };

    // Auto Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Mic is ALWAYS enabled now per user request
    // const isMicEnabled = true; // Removed, using isMicActive derived state

    useEffect(() => {
        // Ensure legacy state doesn't interfere if we ever revert to using localStorage
        localStorage.setItem('isMicEnabled', 'true');
    }, []);

    // Debug State
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const log = (msg: string) => {
        console.log(msg);
        setDebugLog(prev => [...prev.slice(-4), msg]); // Keep last 5
    };

    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    });

    // Mic Device Selection
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(() => {
        return localStorage.getItem('selectedDeviceId') || undefined;
    });

    useEffect(() => {
        if (selectedDeviceId) {
            localStorage.setItem('selectedDeviceId', selectedDeviceId);
        }
    }, [selectedDeviceId]);



    // Visual Effects State
    const [visualEffectsEnabled, setVisualEffectsEnabled] = useState(() => {
        const stored = localStorage.getItem('visualEffectsEnabled');
        return stored !== null ? stored === 'true' : true; // Default: enabled
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('visualEffectsEnabled', String(visualEffectsEnabled));
    }, [visualEffectsEnabled]);

    // Beat History for Visualizer
    const [beatHistory, setBeatHistory] = useState<number[]>([]);

    useEffect(() => {
        localStorage.setItem('audioLatency', audioLatency.toString());
    }, [audioLatency]);

    useEffect(() => {
        localStorage.setItem('micGain', micGain.toString());
    }, [micGain]);

    useEffect(() => {
        localStorage.setItem('micThreshold', micThreshold.toString());
    }, [micThreshold]);

    // ---- Hooks ----
    const {
        bpm, isPlaying, start, stop, changeBpm,
        currentStep, lastBeatTime, isCountIn,
        setSubdivision, setGapClick, setPattern,
        audioContext,
        initializeAudio
    } = useMetronome({ audioLatency });

    // Media Session API Integration
    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                console.log('[MediaSession] Play triggered');
                start();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                console.log('[MediaSession] Pause triggered');
                stop();
            });

            // Set initial metadata
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Rhythm Trainer',
                artist: 'Training Session'
            });
        }
        return () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
            }
        };
    }, [start, stop]);

    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [isPlaying]);

    // timerDuration is in MINUTES, timerRemaining is in SECONDS
    const [timerDuration, setTimerDuration] = useState<number | null>(null); // minutes
    const [timerRemaining, setTimerRemaining] = useState<number>(0); // seconds
    const [stopRequestPending, setStopRequestPending] = useState(false);
    const [showTimerDialog, setShowTimerDialog] = useState(false);
    const [completionMessage, setCompletionMessage] = useState<string | null>(null);
    const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);
    const [customTimerInput, setCustomTimerInput] = useState("10");

    // Initialize/Reset remaining time when duration changes
    useEffect(() => {
        if (timerDuration !== null) {
            setTimerRemaining(timerDuration * 60); // Convert minutes to seconds
            setStopRequestPending(false);
        } else {
            setTimerRemaining(0);
            setStopRequestPending(false);
        }
    }, [timerDuration]);

    // Countdown Effect
    useEffect(() => {
        let interval: any;
        if (isPlaying && timerDuration !== null && timerRemaining > 0 && !isCountIn) {
            interval = setInterval(() => {
                setTimerRemaining(prev => {
                    const next = prev - 1;
                    if (next <= 0) {
                        setStopRequestPending(true);
                        return 0;
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, timerDuration, timerRemaining, isCountIn]);

    // Loop Stop Logic - Stop at the start of the next loop (step 0) after timer expires
    const prevStepRef = React.useRef(currentStep);
    useEffect(() => {
        if (isPlaying && stopRequestPending) {
            // Detect loop boundary: when currentStep goes from a higher value back to 0
            const wasHigherStep = prevStepRef.current > 0;
            const isNowAtZero = currentStep === 0;

            if (wasHigherStep && isNowAtZero) {
                stop();
                handleTimerCompletion();
            }
        }
        prevStepRef.current = currentStep;
    }, [currentStep, isPlaying, stopRequestPending, stop]);

    // Fallback: if stopRequestPending and timer has been at 0 for 5 seconds, force stop
    useEffect(() => {
        let fallbackTimer: any;
        if (isPlaying && stopRequestPending && timerRemaining <= 0) {
            fallbackTimer = setTimeout(() => {
                if (isPlaying && stopRequestPending) {
                    stop();
                    handleTimerCompletion();
                }
            }, 5000);
        }
        return () => clearTimeout(fallbackTimer);
    }, [isPlaying, stopRequestPending, timerRemaining, stop]);

    const handleTimerCompletion = () => {
        // Prepare completion message
        // We need to wait a tick for stats to maybe update? 
        // Or just use what we have. Rank is calculated in real-time in SessionManager usually?
        // Actually lastSessionStats is from *previous* session until we update.
        // But we just called stop().

        // Let's create a temporary effect or just trigger visualization now.
        setShowCompletionOverlay(true);
        setStopRequestPending(false);
        setTimerRemaining(0);

        // Voice Feedback
        if ('speechSynthesis' in window) {
            // Wait a moment for visual confirmation, then speak
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(t('sessionFinished'));
                // Try to pick a Japanese voice if available and appropriate
                const voices = window.speechSynthesis.getVoices();
                if (i18n.language === 'ja') {
                    const jaVoice = voices.find(v => v.lang.startsWith('ja'));
                    if (jaVoice) utterance.voice = jaVoice;
                }

                window.speechSynthesis.speak(utterance);
            }, 1000);
        }
    };



    // Effect: Set pattern on engine when selection changes
    // Now all patterns (presets and custom) have measures, so we always set the pattern
    useEffect(() => {
        if (expandedMeasures) {
            setPattern(expandedMeasures);
        } else {
            setPattern(null);
        }
    }, [expandedMeasures, setPattern]);

    // Mic is ALWAYS enabled (user setting) but we only Activate stream when needed
    // to prevent Android "Call Mode" lock.
    const isMicActive = isPlaying || isCalibrating || activeTab === 'settings';

    // Audio Analysis
    const {
        isMicReady,
        startAnalysis,
        stopAnalysis,
        onsets: detectedOnsets,
        error: micError,

        analyzer,
        mediaStream,
        clearOnsets,
        currentLevel
    } = useAudioAnalysis({
        audioContext,
        gain: micGain,
        threshold: micThreshold,
        isEnabled: isMicActive, // CONTROLLED HERE
        deviceId: selectedDeviceId
    });

    // Auto-select Internal Mic on Android when in Headphone mode
    useInternalMicSelection(
        outputMode,
        selectedDeviceId,
        setSelectedDeviceId,
        isMicReady
    );

    // Make onsets available for calibration
    // We need to alias detectedOnsets to 'onsets' for the rest of compiled code or just use detectedOnsets
    const onsets = detectedOnsets;

    // Mirror analyzer in ref for async access
    const micAnalyzerRef = React.useRef<any>(null);
    useEffect(() => {
        micAnalyzerRef.current = analyzer;
    }, [analyzer]);

    // Mirror AudioContext in ref for async access (fix for 1st run issue)
    const audioContextRef = React.useRef<AudioContext | null>(null);
    useEffect(() => {
        audioContextRef.current = audioContext;
    }, [audioContext]);

    // ---- Mic Auto Calibration ----
    const [micCalibState, setMicCalibState] = useState<{
        active: boolean,
        step: 'idle' | 'noise' | 'bleed' | 'signal' | 'calculating' | 'finished',
        noisePeak: number,
        bleedPeak: number,
        signalPeaks: number[],
        hitCount: number,
        message: string
    }>({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });

    const micCalibRef = React.useRef<{
        timer: any,
        poll: any,
        startTime: number,
        maxPeak: number,
        lastHitTime: number
    }>({ timer: null, poll: null, startTime: 0, maxPeak: 0, lastHitTime: 0 });

    const runMicAutoCalibration = async () => {
        setIsCalibrating(true);

        // 1. Initial Start Trigger
        setMicCalibState({ active: true, step: 'noise', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: 'Starting... Please wait.' });

        // 2. Ensure Audio Context exists (resume/create)
        if (!audioContextRef.current) {
            console.log('[MicCalib] Init Audio Context...');
            initializeAudio(); // This triggers state update -> effect -> ref update
            // Wait for ref to populate
            let retries = 0;
            while (!audioContextRef.current && retries < 20) {
                await new Promise(r => setTimeout(r, 100));
                retries++;
            }
        }

        // Resume if suspended (important for sound on first click)
        if (audioContextRef.current?.state === 'suspended') {
            try {
                await audioContextRef.current.resume();
                console.log('[MicCalib] Resumed Audio Context');
            } catch (e) { console.error(e); }
        }

        // 3. Wait for Analyzer to be populated (via Effect)
        let retries = 0;
        // Wait up to 5s for Analyzer to be ready (50 * 100ms)
        while (!micAnalyzerRef.current && retries < 50) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }

        if (!micAnalyzerRef.current) {
            // Fatal error
            alert("Microphone initialization failed. Please try again.");
            setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
            setIsCalibrating(false);
            return;
        }

        // 4. Start Analysis if not ready (User Gesture flow)
        if (!isMicReady) {
            console.log('[MicCalib] Starting analysis stream...');
            try {
                await startAnalysis();
                // Grace period for stream to stabilize
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                console.error(e);
                alert("Failed to access microphone. Please check permissions.");
                setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
                setIsCalibrating(false);
                return;
            }
        }

        setMicCalibState(prev => ({ ...prev, message: 'Quietly wait... Measuring noise.' }));

        // Reset Ref
        micCalibRef.current = { timer: null, poll: null, startTime: 0, maxPeak: 0, lastHitTime: 0 };

        // Step 1: Measure Noise (3s)
        micCalibRef.current.poll = setInterval(() => {
            if (micAnalyzerRef.current) {
                const lvl = micAnalyzerRef.current.currentLevel;
                if (lvl > micCalibRef.current.maxPeak) micCalibRef.current.maxPeak = lvl;
            }
        }, 50);

        micCalibRef.current.timer = setTimeout(() => {
            if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
            micCalibRef.current.poll = null;
            micCalibRef.current.timer = null;

            const noise = micCalibRef.current.maxPeak;
            console.log('[MicCalib] Noise Floor:', noise);

            // ---- NEW Step 1.5: Measure Click Bleed ----
            setMicCalibState(prev => ({ ...prev, step: 'bleed', noisePeak: noise, message: 'Measuring Click Sound... Stay Quiet.' }));

            // Generate Clicks - Comprehensive Test Sequence
            // We want to test ALL sounds the engine might make:
            // 1000Hz (Count-in), 880Hz (Downbeat), 440Hz (Beat), 220Hz (Subdivision)
            // Play 4 of each quickly to catch resonance/reverb.
            const ctx = audioContextRef.current;
            if (ctx) {
                const now = ctx.currentTime;
                const freqs = [1000, 880, 440, 220]; // All engine frequencies
                let config: { time: number, freq: number }[] = [];

                // Gap between sets: 0.8s, Gap between clicks: 0.3s
                let startTime = now + 0.5;

                freqs.forEach(freq => {
                    for (let i = 0; i < 4; i++) {
                        config.push({ time: startTime, freq });
                        startTime += 0.25; // 250ms apart
                    }
                    startTime += 0.5; // Pause between frequencies
                });

                config.forEach(({ time, freq }) => {
                    const osc = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    osc.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    osc.frequency.value = freq;
                    // Match MetronomeEngine envelope
                    gainNode.gain.setValueAtTime(0, time);
                    gainNode.gain.linearRampToValueAtTime(1.0, time + 0.001);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
                    osc.start(time);
                    osc.stop(time + 0.06);
                });
            }

            // Reset Ref for Bleed measurement
            micCalibRef.current.maxPeak = 0;

            // Poll for sufficient time to cover all clicks
            // 4 freqs * 4 clicks * 0.25s + gaps ~= 5-6s total
            micCalibRef.current.poll = setInterval(() => {
                if (micAnalyzerRef.current) {
                    const lvl = micAnalyzerRef.current.currentLevel;
                    if (lvl > micCalibRef.current.maxPeak) micCalibRef.current.maxPeak = lvl;
                }
            }, 20);

            micCalibRef.current.timer = setTimeout(() => {
                if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
                micCalibRef.current.poll = null;
                micCalibRef.current.timer = null;

                const bleed = micCalibRef.current.maxPeak;
                console.log('[MicCalib] Bleed Peak:', bleed);

                // Determine Effective Noise Floor
                // If bleed is significantly higher than noise, use bleed as floor.
                // But if bleed is HUGE (feedback loop), we might need to be careful?
                // For now, simple max.

                setMicCalibState(_ => ({
                    active: true,
                    step: 'signal',
                    noisePeak: noise,
                    bleedPeak: bleed,
                    signalPeaks: [],
                    hitCount: 0,
                    message: 'Now HIT the pad 5 times!'
                }));

                // Step 2: Measure Signal
                micCalibRef.current.maxPeak = 0; // Reset max for signal phase
                micCalibRef.current.startTime = Date.now();
                micCalibRef.current.lastHitTime = 0;
                const collectedPeaks: number[] = [];
                let hits = 0;

                // Determine Hit Threshold (temporary for detection)
                // Must be above noise AND bleed
                const detectionFloor = Math.max(noise, bleed);
                const detectionThresh = Math.max(detectionFloor * 1.5, 0.03);

                // Re-start polling for signal detection
                micCalibRef.current.poll = setInterval(() => {
                    if (micAnalyzerRef.current) {
                        const lvl = micAnalyzerRef.current.currentLevel;
                        const now = Date.now();

                        // Track global max for safety
                        if (lvl > micCalibRef.current.maxPeak) micCalibRef.current.maxPeak = lvl;

                        // Hit Detection Logic
                        if (lvl > detectionThresh) {
                            // Debounce: 200ms
                            if (now - micCalibRef.current.lastHitTime > 200) {
                                micCalibRef.current.lastHitTime = now;
                                hits++;
                                collectedPeaks.push(lvl);
                                console.log('Calib Hit!', hits, lvl);

                                setMicCalibState(prev => ({
                                    ...prev,
                                    hitCount: hits,
                                    signalPeaks: [...prev.signalPeaks, lvl],
                                    message: `Hit Detected! ${hits}/5`
                                }));

                                if (hits >= 5) {
                                    // Done!
                                    finishMicCalibration(collectedPeaks);
                                }
                            }
                        }
                    }
                }, 20);

            }, 6000); // 6.0s for Extended Bleed check

        }, 3000); // 3s for Noise check
    };

    // Handle Signal Step in separate Effect to watch 'onsets'
    useEffect(() => {
        if (micCalibState.step !== 'signal') return;

        // Cleanup timer on unmount/change

        if (!micCalibRef.current.timer) {
            micCalibRef.current.timer = setTimeout(() => {
                // Timeout: Finish with whatever we have
                finishMicCalibration();
            }, 8000); // Give 8s to be safe
        }

    }, [micCalibState.step]);

    // Watch onsets during signal calibration
    useEffect(() => {
        if (micCalibState.step === 'signal' && onsets.length > 0) {
            // Unused as we use poll loop now
        }
    }, [onsets]);

    const finishMicCalibration = (peaksOverride?: number[]) => {
        if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
        if (micCalibRef.current.timer) clearTimeout(micCalibRef.current.timer);
        micCalibRef.current.poll = null;
        micCalibRef.current.timer = null;

        const noise = micCalibState.noisePeak;
        const bleed = micCalibState.bleedPeak;

        // Use collected peaks if available, otherwise just maxPeak
        let signalMax = micCalibRef.current.maxPeak;

        if (peaksOverride && peaksOverride.length > 0) {
            const sorted = peaksOverride.sort((a, b) => b - a);
            // Take top 3 average
            const top = sorted.slice(0, 3);
            signalMax = top.reduce((a, b) => a + b, 0) / top.length;
        }

        console.log('[MicCalib] Signal Measure:', signalMax);

        // Use Effective Floor
        const effectiveFloor = Math.max(noise, bleed);
        console.log(`[MicCalib] Floor: ${effectiveFloor.toFixed(4)} (N:${noise.toFixed(4)}, B:${bleed.toFixed(4)})`);

        if (signalMax < 0.01) {
            // Failed to detect inputs
            setMicCalibState(prev => ({ ...prev, message: 'No signal detected. Try forcing Gain up.' }));
            setTimeout(() => {
                setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
                setIsCalibrating(false);
                stopAnalysis();
            }, 2000);
            return;
        }

        // Check if calibration is feasible
        // If bleed >= 80% of signal, it's impossible to distinguish clicks from pad hits
        if (bleed >= signalMax * 0.8) {
            setMicCalibState(prev => ({ ...prev, message: 'Error: Click sound is louder than pad sound. Move mic closer to pad or reduce speaker volume.' }));
            setTimeout(() => {
                setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
                setIsCalibrating(false);
                stopAnalysis();
            }, 4000);
            return;
        }

        // Calculate
        // Goal: Signal ~ 0.5 (50% full scale)
        // But apply SAFETY MARGIN: reduce gain by 20% to avoid over-sensitivity
        let targetGain = micGain * (0.5 / signalMax) * 0.8;
        targetGain = Math.max(1.0, Math.min(10.0, targetGain));

        // Threshold Calculation
        const gainRatio = targetGain / micGain;
        const projectedFloor = effectiveFloor * gainRatio;
        const projectedSignal = signalMax * gainRatio; // Should be ~0.4 now (due to 0.8 factor)

        // Set Threshold
        // SAFETY MARGIN: Major increase to avoid crosstalk.
        // Old: Max(Floor * 4.0, Signal * 0.30)
        // New: Max(Floor * 8.0, Signal * 0.50) - Doubled safety margin per user request
        let targetThreshold = Math.max(projectedFloor * 8.0, projectedSignal * 0.50);
        targetThreshold = Math.max(0.05, Math.min(0.5, targetThreshold));

        // Safety: If Threshold ended up > Signal * 0.8 (too close to signal because floor was high), cap it?
        // No, if floor is high, we MUST have high threshold or we get false positives.

        console.log(`[MicCalib] Result: Gain ${micGain.toFixed(1)}->${targetGain.toFixed(1)}, Thresh ${micThreshold.toFixed(3)}->${targetThreshold.toFixed(3)}`);

        setMicGain(parseFloat(targetGain.toFixed(1)));
        setMicThreshold(parseFloat(targetThreshold.toFixed(3)));

        setMicCalibState(prev => ({ ...prev, step: 'finished', message: `Complete! Gain: ${targetGain.toFixed(1)}, Thresh: ${targetThreshold.toFixed(2)}` }));

        setTimeout(() => {
            setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
            setIsCalibrating(false);
            stopAnalysis(); // Ensure mic is closed
        }, 3000);
    };

    const cancelMicCalibration = () => {
        if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
        if (micCalibRef.current.timer) clearTimeout(micCalibRef.current.timer);
        setMicCalibState({ active: false, step: 'idle', noisePeak: 0, bleedPeak: 0, signalPeaks: [], hitCount: 0, message: '' });
        setIsCalibrating(false);
        stopAnalysis(); // Ensure mic is closed
    };

    // NEW STRATEGY    // Mic Calibration State
    const [calibrationState, setCalibrationState] = useState<{
        active: boolean,
        startTime: number,
        samples: number[],
        count: number,
        status: string // 'starting' | 'waiting_mic' | 'warmup' | 'listening' | 'finished'
    }>({ active: false, startTime: 0, samples: [], count: 0, status: 'starting' });



    const calibrationTimeoutRef = React.useRef<any>(null);

    const runCalibration = async () => {
        setDebugLog([]); // Clear logs
        log('[Init] Run Calibration');

        if (isPlaying) stop();

        if (!audioContext) {
            log('[Init] No AudioContext, Init...');
            initializeAudio();
        } else {
            log(`[Init] Ctx State: ${audioContext.state}`);
            if (audioContext.state === 'suspended') {
                try {
                    await audioContext.resume();
                    log('[Init] Resumed Context');
                } catch (e) { log(`[Err] Resume Fail: ${e}`); }
            }
        }

        setCalibrationState({ active: true, startTime: 0, samples: [], count: 0, status: 'waiting_mic' });
        setIsCalibrating(true);
    };

    const abortCalibration = () => {
        console.log('[AutoCheck] Aborted/Timeout');
        setCalibrationState({ active: false, startTime: 0, samples: [], count: 0, status: 'starting' });
        setIsCalibrating(false);
        stopAnalysis();
        if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
    };

    // Calibration Loop Effect (Scheduling Click)
    useEffect(() => {
        if (!calibrationState.active) {
            if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
            return;
        }

        // Step 0: Ensure Context & Mic
        if (calibrationState.status === 'waiting_mic') {
            if (!audioContext) {
                // Context still loading?
                console.log('[AutoCheck] Waiting for AudioContext...');
                return;
            }

            // Attempt to start analysis if not ready
            if (!isMicReady) {
                console.log('[AutoCheck] Requesting Mic...');
                // We call this every render if not ready, which is fine since startAnalysis is guarded
                startAnalysis();
                return;
            }

            // If ready, proceed to warmup
            console.log('[AutoCheck] Mic ready. Warming up...');
            setCalibrationState(prev => ({ ...prev, status: 'warmup' }));

            if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
            calibrationTimeoutRef.current = setTimeout(() => {
                console.log('[AutoCheck] Warmup complete. Starting clicks.');
                setCalibrationState(prev => ({ ...prev, status: 'starting' }));
            }, 1000); // 1.0s warmup
            return;
        }

        // Step 2: Warmup (waiting for timeout)
        if (calibrationState.status === 'warmup') return;

        // Step 3: Starting clicks
        if (!audioContext) return;

        // If we need to play a click (startTime is 0)
        if (calibrationState.startTime === 0) {
            const now = audioContext.currentTime;
            log(`[Sched] Now: ${now.toFixed(3)}`);

            // Robust Sequence: 4 beats
            // 3 Primers (ensure wake up) + 1 Target
            const GAP = 0.6; // 600ms = 100 BPM
            const times = [
                now + GAP * 1,
                now + GAP * 2,
                now + GAP * 3,
                now + GAP * 4  // Target
            ];

            try {
                times.forEach((t, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);

                    const isTarget = i === 3;
                    osc.type = 'square'; // All Square for max energy/detection
                    osc.frequency.value = 600; // All 600Hz

                    // Gain Envelope: Linear Ramp for controlled click
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(1.0, t + 0.01); // Fast attack
                    gain.gain.setValueAtTime(1.0, t + 0.08); // Sustain
                    gain.gain.linearRampToValueAtTime(0, t + 0.1); // Release

                    osc.start(t);
                    osc.stop(t + 0.15);

                    log(`[Sched] #${i + 1} @ ${t.toFixed(3)} ${isTarget ? '(TARGET)' : ''}`);
                });

                const targetTime = times[3];
                setCalibrationState(prev => ({ ...prev, startTime: targetTime, status: 'listening' }));

                // Timeout
                if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
                calibrationTimeoutRef.current = setTimeout(() => {
                    log('[Err] Timeout waiting for mic input');
                    abortCalibration();
                    alert("Calibration failed: Microphone didn't detect the final beep. Please maximize volume.");
                }, 6000);

            } catch (e: any) {
                log(`[Err] Sched Failed: ${e.message}`);
            }
        }

    }, [calibrationState, audioContext, isMicReady, startAnalysis]);

    // Capture Onset during Calibration
    useEffect(() => {
        if (!calibrationState.active || calibrationState.startTime === 0) return;

        // Check if we have a new onset that matches our start time
        if (onsets.length > 0) {
            const lastOnset = onsets[onsets.length - 1];

            // If the onset is AFTER our click
            if (lastOnset > calibrationState.startTime) {
                const latency = (lastOnset - calibrationState.startTime) * 1000; // ms
                console.log('[AutoCheck] Detection:', latency, 'ms');

                // Clear timeout since we found it
                if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);

                // Sanity check
                if (latency < 1000) {
                    const newSamples = [...calibrationState.samples, latency];

                    if (newSamples.length >= 5) {
                        // Done
                        const avg = newSamples.reduce((a, b) => a + b, 0) / newSamples.length;
                        console.log('[AutoCheck] Complete. Avg:', avg);
                        setAudioLatency(Math.round(avg));
                        setCalibrationState({ active: false, startTime: 0, samples: [], count: 0, status: 'finished' });
                        setIsCalibrating(false);
                        stopAnalysis();
                    } else {
                        // Next iteration
                        console.log('[AutoCheck] Next iteration');
                        setCalibrationState(prev => ({
                            ...prev,
                            samples: newSamples,
                            startTime: 0, // Reset scan trigger
                            count: prev.count + 1,
                            status: 'starting'
                        }));
                    }
                } else {
                    console.warn('[AutoCheck] high latency ignored:', latency);
                }
            }
        }
    }, [onsets, calibrationState]);


    const { feedback, offsetMs, onsetIndex, closestBeatType } = useRhythmScoring({ onsets, lastBeatTime, bpm, audioLatency });
    const { startRecording, stopRecording, clearRecording, audioBlob, startTime, duration } = useAudioRecorder();
    const recordingStartedRef = React.useRef(false);

    // Determine Hand and Step
    let currentHand: 'L' | 'R' = 'R';
    let patternStep: number | undefined = undefined;

    if (selectedPattern) {
        let targetStep = currentStep;
        if (closestBeatType === 'next') targetStep += 1;
        // Normalize
        const len = selectedPattern.sequence.length;
        const index = (targetStep % len + len) % len;
        const note = selectedPattern.sequence[index];
        if (note !== '-') {
            currentHand = note as 'L' | 'R';
        }
        patternStep = index;
    }

    // ---- Logic ----
    const { lastSessionStats, lastSessionHits } = useSessionManager({
        isPlaying,
        bpm,
        patternId: selectedPatternId,
        latestOffsetMs: offsetMs,
        feedback,
        onsetIndex,
        hand: currentHand,
        patternStep, // Pass the pattern step
        disableRecording
    });

    // Manage Completion Overlay (Msg generation + Auto-hide)
    useEffect(() => {
        if (showCompletionOverlay) {
            // 1. Generate Message if not set and data is ready
            if (lastSessionStats?.total?.rank && !completionMessage) {
                const rank = lastSessionStats.total.rank;
                const msgs = t(`completion_messages.${rank.toLowerCase()}`, { returnObjects: true });
                let selected = "Good job!";
                if (Array.isArray(msgs) && msgs.length > 0) {
                    selected = msgs[Math.floor(Math.random() * msgs.length)];
                } else if (typeof msgs === 'string') {
                    selected = msgs;
                }
                setCompletionMessage(selected);
            }

            // 2. Auto-hide timer
            const timer = setTimeout(() => {
                setShowCompletionOverlay(false);
                setCompletionMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showCompletionOverlay, lastSessionStats, completionMessage, t]);

    // Session Summary Tab State
    const [summaryTab, setSummaryTab] = useState<'total' | 'left' | 'right'>('total');

    // ずれ量表示制御: 表示用のfeedbackとoffsetを管理
    const [displayFeedback, setDisplayFeedback] = useState<{ feedback: string | null, offsetMs: number }>({ feedback: null, offsetMs: 0 });
    const displayTimeoutRef = React.useRef<any>(null);
    const lastBeatTimeRef = React.useRef<number>(0);

    // feedbackが更新されたら表示を更新
    useEffect(() => {
        if (feedback) {
            setDisplayFeedback({ feedback, offsetMs });
            // 3秒タイムアウトを設定
            if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
            displayTimeoutRef.current = setTimeout(() => {
                setDisplayFeedback({ feedback: null, offsetMs: 0 });
            }, 3000);
        }
    }, [feedback, offsetMs]);

    // 次の拍で楽器音が検出されなかった場合に消す
    useEffect(() => {
        // 新しい拍が来た（lastBeatTimeが変化した）
        if (lastBeatTime > 0 && lastBeatTime !== lastBeatTimeRef.current) {
            lastBeatTimeRef.current = lastBeatTime;
            // 150ms後にonset検出がなければ消す（遅延を考慮）
            const checkTimeout = setTimeout(() => {
                // onsetIndexが変化してなければ消す（feedbackが更新されてなければ）
                // この時点のdisplayFeedbackと比較するため、タイムアウト時のfeedbackをチェック
                setDisplayFeedback(prev => {
                    // feedbackが前回のまま（新しい入力がない）なら消す
                    // 注：feedbackが更新される場合は上のuseEffectで既に更新されているはず
                    return prev;
                });
            }, 150);
            return () => clearTimeout(checkTimeout);
        }
    }, [lastBeatTime]);

    // 停止時に表示をクリア
    useEffect(() => {
        if (!isPlaying) {
            // 停止後3秒でタイムアウト（既存のタイムアウトはそのまま）
            if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
            displayTimeoutRef.current = setTimeout(() => {
                setDisplayFeedback({ feedback: null, offsetMs: 0 });
            }, 3000);
        }
    }, [isPlaying]);

    // Wrappers for settings updates
    const handleSubdivisionChange = (sub: Subdivision) => {
        setSubdivisionState(sub);
        setSubdivision(sub);
    };

    const handleGapClickChange = (enabled: boolean, play: number, mute: number) => {
        setGapEnabled(enabled);
        setPlayBars(play);
        setMuteBars(mute);
        setGapClick(enabled, play, mute);
    };

    const toggle = async () => {
        // If Calibrating, toggle acts as Cancel
        if (isCalibrating) {
            abortCalibration();
            return;
        }

        if (isPlaying) {
            stop();
            stopRecording();
            stopAnalysis(); // Always stop mic
            recordingStartedRef.current = false;
        } else {
            // Clear previous session data immediately on start
            clearRecording();
            clearOnsets();
            setBeatHistory([]); // Clear history
            recordingStartedRef.current = false;
            setSummaryTab('total'); // Reset tab

            // Reset Timer Logic
            if (timerDuration !== null) {
                setTimerRemaining(timerDuration * 60);
            }
            setStopRequestPending(false);
            setShowCompletionOverlay(false);
            setCompletionMessage(null);

            // ALWAYS Initialize Audio & Request Mic (even for No Rec)
            // This forces text iOS Audio Session to "PlayAndRecord", which is the only way
            // to reliably bypass the Silent Switch and maintain high volume.

            // 1. Ensure Audio Context exists (resume/create)
            if (!audioContextRef.current) {
                console.log('[Start] Init Audio Context...');
                initializeAudio();
                // Wait for ref to populate
                let retries = 0;
                while (!audioContextRef.current && retries < 20) {
                    await new Promise(r => setTimeout(r, 100));
                    retries++;
                }
            }

            // Resume if suspended
            if (audioContextRef.current?.state === 'suspended') {
                try { await audioContextRef.current.resume(); } catch (e) { console.warn(e); }
            }

            // 2. Wait for Analyzer to be populated (via Effect)
            let retries = 0;
            while (!micAnalyzerRef.current && retries < 50) {
                await new Promise(r => setTimeout(r, 50));
                retries++;
            }

            if (!micAnalyzerRef.current) {
                // If analyzer failed, we can still try to start, but warn.
                console.warn("Analyzer not ready. Audio might be quiet in Silent Mode.");
            }

            try {
                // 3. Request Mic Permission (Force PlayAndRecord)
                await startAnalysis();

                // [FIX] Add delay to allow Android audio routing to settle (Call Mode switch)
                // This prevents the "silent count-in" issue caused by the mode switch glitch.
                await new Promise(resolve => setTimeout(resolve, 500));

                // [FIX] Force resume if context got suspended by the mode switch
                if (audioContext?.state === 'suspended') {
                    console.log('[Toggle] Resuming AudioContext after mic init');
                    await audioContext.resume();
                }

            } catch (e) {
                console.warn("Mic failed", e);
                // If permission denied, we still start, but warn user about Silent Switch
                if (!disableRecording) {
                    alert("Microphone access denied. Recording disabled. (Silent switch bypass may fail)");
                    // setDisableRecording(true); // Optional: auto-fallback
                }
            }

            // Start Engine
            start();
        }
    };

    // Capture beats for history
    useEffect(() => {
        if (isPlaying && !disableRecording && !isCountIn && lastBeatTime > 0) {
            setBeatHistory(prev => [...prev, lastBeatTime]);
        }
    }, [lastBeatTime, isPlaying, disableRecording, isCountIn]);


    // Auto-record & Analysis when playing + mic ready
    // Fix: Allow recording/analysis during count-in to prevent delay at 1st beat
    useEffect(() => {
        if (isPlaying && !disableRecording) {
            // Ensure mic analysis is running (fallback if toggle missed it)
            if (!isMicReady) {
                startAnalysis();
            }

            // Start recording if stream is ready and we haven't started yet
            if (isMicReady && mediaStream && !recordingStartedRef.current) {
                startRecording(mediaStream, audioContext?.currentTime || 0);
                recordingStartedRef.current = true;
            }
        }
    }, [isPlaying, isMicReady, mediaStream, disableRecording, audioContext, startAnalysis, startRecording]);

    // Cleanup Effect: Ensure microphone and recording are stopped when playback stops
    useEffect(() => {
        if (!isPlaying && !calibrationState.active && !micCalibState.active) {
            stopAnalysis();
            if (recordingStartedRef.current) {
                stopRecording();
                recordingStartedRef.current = false;
            }
        }
    }, [isPlaying, calibrationState.active, micCalibState.active, stopAnalysis, stopRecording]);

    // ---- Render ----
    return (
        <section className="metronome-container" style={{ padding: '1rem 0', width: '100%', boxSizing: 'border-box', margin: '0 auto', position: 'relative' }}>

            {/* Background Effects (Fullscreen) */}
            <VisualEffectsOverlay
                isPlaying={isPlaying && !isCountIn}
                lastBeatTime={lastBeatTime}
                theme={theme}
                effectsEnabled={visualEffectsEnabled}
                fullscreen={true}
            />

            {/* Timer Completion Overlay */}
            {showCompletionOverlay && (
                <div style={{
                    position: 'fixed',
                    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 2000,
                    pointerEvents: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%'
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.85)',
                        padding: '2rem',
                        borderRadius: '1rem',
                        border: '2px solid var(--color-primary)',
                        textAlign: 'center',
                        animation: 'popIn 0.3s ease-out'
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                            {t('timer.complete')}
                        </div>
                        {lastSessionStats && lastSessionStats.total && completionMessage && (
                            <>
                                <div style={{
                                    fontSize: '4rem',
                                    fontWeight: '900',
                                    color: lastSessionStats.total.rank === 'S' ? '#faad14' :
                                        lastSessionStats.total.rank === 'A' ? '#52c41a' :
                                            lastSessionStats.total.rank === 'B' ? '#1890ff' : '#fa8c16',
                                    marginBottom: '0.5rem',
                                    textShadow: '0 0 20px rgba(255,255,255,0.5)'
                                }}>
                                    {lastSessionStats.total.rank}
                                </div>
                                <div style={{ fontSize: '1.2rem', color: '#eee', fontStyle: 'italic' }}>
                                    {completionMessage}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Timer Running Overlay */}
            {
                isPlaying && timerDuration !== null && timerRemaining >= 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '10px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 500,
                        background: timerRemaining <= 3 && stopRequestPending ? 'rgba(255, 77, 79, 0.9)' : 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        border: timerRemaining <= 0 ? '2px solid #ff4d4f' : '1px solid rgba(255,255,255,0.2)',
                        transition: 'background 0.3s',
                        boxShadow: timerRemaining <= 10 && timerRemaining > 0 ? '0 0 10px rgba(255,255,255,0.3)' : 'none'
                    }}>
                        {t('timer.remaining')}: {Math.max(0, Math.floor(timerRemaining / 60))}{t('timer.minute')} {Math.max(0, timerRemaining % 60).toString().padStart(2, '0')}{t('timer.second')}
                    </div>
                )
            }

            {/* Tabs */}
            <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid var(--color-surface-hover)', padding: '0 0.5rem', gap: '2px' }}>
                {/* Main Tabs */}
                {['training', 'history'].map(tab => (
                    <RippleButton
                        key={tab}
                        onClick={() => handleTabChange(tab as any)}
                        effectsEnabled={visualEffectsEnabled}
                        theme={theme}
                        style={{
                            flex: 1,
                            padding: '0.8rem 0.5rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-dim)',
                            borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                            fontWeight: 'bold',
                            textTransform: 'capitalize',
                            fontSize: '1rem',
                            transition: 'color 0.2s, border-bottom 0.2s',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t(`tabs.${tab}`)}
                    </RippleButton>
                ))}

                {/* Secondary Tabs (Small Icons) */}
                <RippleButton
                    onClick={() => handleTabChange('manual')}
                    effectsEnabled={visualEffectsEnabled}
                    theme={theme}
                    style={{
                        padding: '0.8rem 0.5rem',
                        border: 'none',
                        background: 'transparent',
                        color: activeTab === 'manual' ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        borderBottom: activeTab === 'manual' ? '3px solid var(--color-primary)' : '3px solid transparent',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        minWidth: '36px'
                    }}
                    title="Manual"
                >
                    ?
                </RippleButton>
                <RippleButton
                    onClick={() => handleTabChange('settings')}
                    effectsEnabled={visualEffectsEnabled}
                    theme={theme}
                    style={{
                        padding: '0.8rem 0.5rem',
                        border: 'none',
                        background: 'transparent',
                        color: activeTab === 'settings' ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        borderBottom: activeTab === 'settings' ? '3px solid var(--color-primary)' : '3px solid transparent',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        minWidth: '36px'
                    }}
                    title="Settings"
                >
                    {/* Gear Icon - Bold SVG */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </RippleButton>
                <RippleButton
                    onClick={() => handleTabChange('editor')}
                    effectsEnabled={visualEffectsEnabled}
                    theme={theme}
                    style={{
                        padding: '0.8rem 0.5rem',
                        border: 'none',
                        background: 'transparent',
                        color: activeTab === 'editor' ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        borderBottom: activeTab === 'editor' ? '3px solid var(--color-primary)' : '3px solid transparent',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        minWidth: '36px'
                    }}
                    title="Pattern Editor"
                >
                    {/* Pencil Icon - Bold SVG */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                </RippleButton>
            </div>

            {/* Global Calibration Overlays - Visible across all tabs */}
            {
                (calibrationState.active || micCalibState.active) && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            background: 'var(--color-surface)',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            width: '90%',
                            maxWidth: '360px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            border: '2px solid var(--color-primary)'
                        }}>
                            {/* Latency Calibration UI */}
                            {calibrationState.active && (
                                <>
                                    <div style={{
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        color: 'var(--color-primary)',
                                        marginBottom: '1rem',
                                        textAlign: 'center'
                                    }}>
                                        {t('calibration.latency_title')}
                                    </div>

                                    {/* Step indicator */}
                                    <div style={{
                                        background: 'var(--color-surface-hover)',
                                        borderRadius: '0.5rem',
                                        padding: '1rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            marginBottom: '0.5rem',
                                            color: 'var(--color-text)'
                                        }}>
                                            {t('calibration.step_of')} {calibrationState.count + 1}/5
                                        </div>
                                        <div style={{
                                            fontSize: '0.95rem',
                                            color: 'var(--color-text-dim)'
                                        }}>
                                            {calibrationState.status === 'waiting_mic' && t('calibration.latency_step_prep')}
                                            {calibrationState.status === 'warmup' && t('calibration.latency_step_warmup')}
                                            {(calibrationState.status === 'starting' || calibrationState.status === 'listening') && t('calibration.latency_step_listen')}
                                        </div>
                                    </div>

                                    {/* Tip */}
                                    <div style={{
                                        background: 'rgba(250, 173, 20, 0.15)',
                                        border: '1px solid rgba(250, 173, 20, 0.3)',
                                        borderRadius: '0.5rem',
                                        padding: '0.75rem',
                                        marginBottom: '1rem',
                                        fontSize: '0.9rem',
                                        color: '#faad14',
                                        textAlign: 'center'
                                    }}>
                                        {t('calibration.latency_tip')}
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--color-border)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: '1rem',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${((calibrationState.count + 1) / 5) * 100}%`,
                                            height: '100%',
                                            background: 'var(--color-primary)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>

                                    {/* Debug log (collapsible) */}
                                    {debugLog.length > 0 && (
                                        <details style={{ marginBottom: '1rem' }}>
                                            <summary style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', cursor: 'pointer' }}>
                                                Debug Log
                                            </summary>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: '#aaa',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                marginTop: '0.5rem',
                                                maxHeight: '100px',
                                                overflowY: 'auto'
                                            }}>
                                                {debugLog.map((l, i) => <div key={i}>{l}</div>)}
                                            </div>
                                        </details>
                                    )}

                                    <button
                                        onClick={abortCalibration}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: 'var(--color-surface-hover)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '0.5rem',
                                            color: 'var(--color-text)',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('calibration.cancel')}
                                    </button>
                                </>
                            )}

                            {/* Mic Calibration UI */}
                            {micCalibState.active && (
                                <>
                                    <div style={{
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        color: 'var(--color-primary)',
                                        marginBottom: '1rem',
                                        textAlign: 'center'
                                    }}>
                                        {t('calibration.mic_title')}
                                    </div>

                                    {/* Step indicator */}
                                    <div style={{
                                        background: 'var(--color-surface-hover)',
                                        borderRadius: '0.5rem',
                                        padding: '1rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            marginBottom: '0.5rem',
                                            color: 'var(--color-text)'
                                        }}>
                                            {t('calibration.step_of')} {
                                                micCalibState.step === 'noise' ? '1/4' :
                                                    micCalibState.step === 'bleed' ? '2/4' :
                                                        micCalibState.step === 'signal' ? '3/4' :
                                                            micCalibState.step === 'finished' ? '4/4' : '1/4'
                                            }
                                        </div>
                                        <div style={{
                                            fontSize: '0.95rem',
                                            color: 'var(--color-text-dim)'
                                        }}>
                                            {micCalibState.step === 'noise' && t('calibration.mic_step_noise')}
                                            {micCalibState.step === 'bleed' && t('calibration.mic_step_bleed')}
                                            {micCalibState.step === 'signal' && t('calibration.mic_step_signal')}
                                            {micCalibState.step === 'finished' && t('calibration.mic_step_done')}
                                        </div>

                                        {/* Hit counter for signal step */}
                                        {micCalibState.step === 'signal' && (
                                            <div style={{
                                                marginTop: '0.75rem',
                                                fontSize: '1.5rem',
                                                fontWeight: 'bold',
                                                color: 'var(--color-primary)'
                                            }}>
                                                {micCalibState.hitCount}/5
                                            </div>
                                        )}
                                    </div>

                                    {/* Tip based on step */}
                                    {micCalibState.step !== 'finished' && (
                                        <div style={{
                                            background: micCalibState.step === 'signal'
                                                ? 'rgba(82, 196, 26, 0.15)'
                                                : 'rgba(250, 173, 20, 0.15)',
                                            border: micCalibState.step === 'signal'
                                                ? '1px solid rgba(82, 196, 26, 0.3)'
                                                : '1px solid rgba(250, 173, 20, 0.3)',
                                            borderRadius: '0.5rem',
                                            padding: '0.75rem',
                                            marginBottom: '1rem',
                                            fontSize: '0.9rem',
                                            color: micCalibState.step === 'signal' ? '#52c41a' : '#faad14',
                                            textAlign: 'center'
                                        }}>
                                            {micCalibState.step === 'signal'
                                                ? t('calibration.mic_hit_tip')
                                                : t('calibration.mic_noise_tip')}
                                        </div>
                                    )}

                                    {/* Success message */}
                                    {micCalibState.step === 'finished' && (
                                        <div style={{
                                            background: 'rgba(82, 196, 26, 0.15)',
                                            border: '1px solid rgba(82, 196, 26, 0.3)',
                                            borderRadius: '0.5rem',
                                            padding: '0.75rem',
                                            marginBottom: '1rem',
                                            fontSize: '0.9rem',
                                            color: '#52c41a',
                                            textAlign: 'center'
                                        }}>
                                            ✅ {micCalibState.message}
                                        </div>
                                    )}

                                    {/* Progress bar */}
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--color-border)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: '1rem',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${micCalibState.step === 'noise' ? 25 :
                                                micCalibState.step === 'bleed' ? 50 :
                                                    micCalibState.step === 'signal' ? 75 :
                                                        micCalibState.step === 'finished' ? 100 : 25
                                                }%`,
                                            height: '100%',
                                            background: micCalibState.step === 'finished'
                                                ? '#52c41a'
                                                : 'var(--color-primary)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>

                                    {micCalibState.step !== 'finished' && (
                                        <button
                                            onClick={cancelMicCalibration}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                background: 'var(--color-surface-hover)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '0.5rem',
                                                color: 'var(--color-text)',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {t('calibration.cancel')}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'training' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem', position: 'relative' }}>

                        {/* 1. Pattern Select */}
                        <div>
                            <select
                                value={selectedPatternId}
                                onChange={(e) => {
                                    if (isPlaying) stop();
                                    setSelectedPatternId(e.target.value);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    fontSize: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border)',
                                    outline: 'none'
                                }}
                            >

                                <optgroup label={t('presets') || "Presets"}>
                                    {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </optgroup>
                                {customPatterns.length > 0 && (
                                    <optgroup label={t('custom') || "Custom"}>
                                        {customPatterns.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        {/* Visualizer & Feedback */}
                        <div style={{ position: 'relative' }}>
                            <VisualEffectsOverlay
                                isPlaying={isPlaying && !isCountIn}
                                lastBeatTime={lastBeatTime}
                                theme={theme}
                                effectsEnabled={visualEffectsEnabled}
                            />
                            <PatternVisualizer
                                pattern={selectedPattern}
                                currentStep={currentStep}
                                isPlaying={isPlaying}
                                subdivision={subdivision}
                                expandedMeasures={expandedMeasures}
                                effectsEnabled={visualEffectsEnabled}
                                theme={theme}
                            />

                            {isPlaying && isCountIn && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.8)',
                                    color: '#fff',
                                    padding: '1rem',
                                    borderRadius: '1rem',
                                    fontWeight: 'bold',
                                    fontSize: '2rem',
                                    zIndex: 100,
                                    pointerEvents: 'none',
                                    whiteSpace: 'nowrap'
                                }}>
                                    COUNT IN
                                </div>
                            )}

                        </div>


                        {/* Feedback Display (Gauge) */}
                        <div style={{ height: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <TimingGauge offsetMs={displayFeedback.offsetMs} feedback={displayFeedback.feedback} />
                            <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {displayFeedback.feedback && (
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: displayFeedback.feedback === 'Perfect' ? 'var(--color-success)' : displayFeedback.feedback === 'Good' ? 'var(--color-accent)' : 'var(--color-error)' }}>
                                        {Math.round(Math.abs(displayFeedback.offsetMs))}ms
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Unified Control Panel (Start/Stop + Tempo) */}
                        <div className="control-panel" style={{
                            display: 'flex',
                            alignItems: 'stretch',
                            background: 'var(--color-surface)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid var(--color-border)',
                            position: 'relative' // Ensure popovers can overflow if needed
                        }}>
                            {/* Left: Start/Stop Button */}
                            <div style={{
                                flex: '0 0 85px',
                                borderRight: '1.5px solid var(--color-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'visible'
                            }}>
                                <button
                                    onClick={toggle}
                                    style={{
                                        flex: 1,
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: isPlaying ? 'transparent' : 'var(--color-primary)',
                                        color: isPlaying ? 'var(--color-accent)' : '#fff',
                                        border: 'none',
                                        borderBottom: '1px solid var(--color-border)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        borderTopLeftRadius: 'var(--radius-lg)'
                                    }}
                                >
                                    {isPlaying ? (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="6" width="12" height="12" rx="1" />
                                        </svg>
                                    ) : (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    )}
                                </button>

                                {/* Bottom Row: Timer & NoRec */}
                                <div style={{ display: 'flex', height: '36px', borderTop: '1px solid var(--color-border)' }}>
                                    {/* Timer Button */}
                                    <div style={{ position: 'relative', flex: 1, borderRight: '1px solid var(--color-border)' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowTimerDialog(!showTimerDialog); }}
                                            style={{
                                                width: '100%', height: '100%',
                                                background: timerDuration !== null ? 'var(--color-primary)' : 'transparent',
                                                color: timerDuration !== null ? '#fff' : 'var(--color-text)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderBottomLeftRadius: 'var(--radius-lg)'
                                            }}
                                            title={t('timer.title')}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polyline points="12 6 12 12 16 14"></polyline>
                                            </svg>
                                        </button>

                                        {/* Timer Dialog Popover */}
                                        {showTimerDialog && (
                                            <>
                                                <div
                                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                                                    onClick={() => setShowTimerDialog(false)}
                                                />
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '100%', left: '0', marginBottom: '8px',
                                                    background: 'var(--color-surface)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '0.5rem',
                                                    padding: '0.5rem',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                    zIndex: 999,
                                                    minWidth: '160px',
                                                    display: 'flex', flexDirection: 'column', gap: '4px'
                                                }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-dim)', padding: '4px' }}>{t('timer.title')}</div>
                                                    <button
                                                        onClick={() => { setTimerDuration(3); setShowTimerDialog(false); }}
                                                        style={{
                                                            padding: '8px', borderRadius: '4px', border: 'none',
                                                            background: timerDuration === 3 ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                                                            cursor: 'pointer',
                                                            color: timerDuration === 3 ? '#fff' : 'var(--color-text)'
                                                        }}
                                                    >
                                                        {t('timer.min_3')}
                                                    </button>
                                                    <button
                                                        onClick={() => { setTimerDuration(5); setShowTimerDialog(false); }}
                                                        style={{
                                                            padding: '8px', borderRadius: '4px', border: 'none',
                                                            background: timerDuration === 5 ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                                                            cursor: 'pointer',
                                                            color: timerDuration === 5 ? '#fff' : 'var(--color-text)'
                                                        }}
                                                    >
                                                        {t('timer.min_5')}</button>
                                                    <div style={{ display: 'flex', gap: '4px', padding: '4px' }}>
                                                        <input
                                                            type="number"
                                                            value={customTimerInput}
                                                            onChange={(e) => setCustomTimerInput(e.target.value)}
                                                            style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                                                        />
                                                        <button
                                                            onClick={() => { setTimerDuration(parseInt(customTimerInput) || 3); setShowTimerDialog(false); }}
                                                            style={{
                                                                flex: 1, padding: '4px', borderRadius: '4px',
                                                                border: '1px solid var(--color-border)',
                                                                background: (timerDuration !== 3 && timerDuration !== 5 && timerDuration !== null) ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                                                                color: (timerDuration !== 3 && timerDuration !== 5 && timerDuration !== null) ? '#fff' : 'var(--color-text)',
                                                                cursor: 'pointer', fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            {t('timer.set')}
                                                        </button>
                                                    </div>
                                                    <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />
                                                    <button onClick={() => { setTimerDuration(null); setShowTimerDialog(false); }} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff4d4f' }}>{t('timer.off')}</button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* NoRec Button */}
                                    <button
                                        onClick={() => setDisableRecording(!disableRecording)}
                                        style={{
                                            flex: 1,
                                            width: '100%', height: '100%',
                                            background: disableRecording ? '#e67700' : 'transparent', // Orange when active (NoRec ON)
                                            color: disableRecording ? '#fff' : 'var(--color-text)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="No Recording"
                                    >
                                        {disableRecording ? (
                                            // Mic Off
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                                <line x1="8" y1="23" x2="16" y2="23"></line>
                                            </svg>
                                        ) : (
                                            // Mic On (but usually this button is 'NoRec', so inactive state is actually 'Mic On' logic-wise, but visual is 'NoRec Off' -> Mic Normal)
                                            // User wanted "Mic with X icon"
                                            // Wait, user said "Mic with X icon" for the BUTTON itself.
                                            // If disableRecording is FALSE (Mic ON), button should be inactive styling.
                                            // If disableRecording is TRUE (Mic OFF), button should be ACTIVE styling (Orange).
                                            // So the Icon should PROBABLY always be "Mic Off" to represent the function "Disable Mic".
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                                <line x1="8" y1="23" x2="16" y2="23"></line>
                                                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" style={{ display: 'none' }} />
                                                {/* Just a standard mic icon effectively? No, let's use Mic Off icon always, but dim if inactive. */}
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Right: Tempo Controls */}
                            <div style={{
                                flex: 1,
                                padding: '1rem 0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                minWidth: 0,
                                borderTopRightRadius: 'var(--radius-lg)',
                                borderBottomRightRadius: 'var(--radius-lg)',
                                background: 'var(--color-surface)'
                            }}>

                                {/* Subdivision & GapClick & TEMPO Label */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 8px' }}>
                                    <SubdivisionControl
                                        subdivision={subdivision}
                                        onChange={handleSubdivisionChange}
                                        disabled={selectedPattern.isCustom}
                                    />
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', fontWeight: 'bold', letterSpacing: '1px', flex: 1, textAlign: 'center' }}>TEMPO</div>
                                    <GapClickControl
                                        enabled={gapEnabled}
                                        playBars={playBars}
                                        muteBars={muteBars}
                                        onChange={handleGapClickChange}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                                    <button onClick={() => changeBpm(bpm - 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontSize: '0.85rem' }}>-10</button>
                                    <button onClick={() => changeBpm(bpm - 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontSize: '0.85rem' }}>-1</button>

                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', minWidth: '60px', textAlign: 'center', margin: '0 4px' }}>
                                        {bpm}
                                    </div>

                                    <button onClick={() => changeBpm(bpm + 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontSize: '0.85rem' }}>+1</button>
                                    <button onClick={() => changeBpm(bpm + 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontSize: '0.85rem' }}>+10</button>
                                </div>

                                {/* Slider */}
                                <input
                                    type="range"
                                    min="40" max="240"
                                    value={bpm}
                                    onChange={e => changeBpm(parseInt(e.target.value))}
                                    style={{ width: '95%', margin: '4px auto 0', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        {/* Review Waveform */}
                        {/* Review Waveform & Session Report */}
                        {!isPlaying && (lastSessionStats || audioBlob) && (
                            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                                {/* Session Summary Panel */}
                                {lastSessionStats && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '1rem',
                                        background: 'var(--color-surface)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        {/* Tabs for Analysis */}
                                        <div style={{ display: 'flex', marginBottom: '1rem', background: 'var(--color-bg)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                                            {(['total', 'left', 'right'] as const).map(tabKey => {
                                                const label = t(`report.${tabKey}`);
                                                const isActive = summaryTab === tabKey;
                                                const hasData = tabKey === 'total' || (tabKey === 'left' && lastSessionStats.left) || (tabKey === 'right' && lastSessionStats.right);

                                                if (!hasData) return null;

                                                return (
                                                    <button
                                                        key={tabKey}
                                                        onClick={() => setSummaryTab(tabKey)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.4rem',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 'bold',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            background: isActive ? 'var(--color-primary)' : 'transparent',
                                                            color: isActive ? '#fff' : 'var(--color-text-dim)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {label}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Selected Data Content */}
                                        {(() => {
                                            const data = summaryTab === 'total'
                                                ? lastSessionStats.total
                                                : summaryTab === 'left'
                                                    ? lastSessionStats.left
                                                    : lastSessionStats.right;

                                            if (!data) return <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>{t('report.no_data')}</div>;

                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {/* Left: Rank & Score */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                                                        <div style={{
                                                            fontSize: '3rem',
                                                            fontWeight: '900',
                                                            lineHeight: 1,
                                                            color: data.rank === 'S' ? '#faad14' :
                                                                data.rank === 'A' ? '#52c41a' :
                                                                    data.rank === 'B' ? '#1890ff' :
                                                                        data.rank === 'C' ? '#fa8c16' : '#ff4d4f',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        }}>
                                                            {data.rank}
                                                        </div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ccc' }}>
                                                            {data.score} <span style={{ fontSize: '0.7rem' }}>{t('report.pts')}</span>
                                                        </div>
                                                    </div>

                                                    {/* Right: Metrics Bars */}
                                                    <div style={{ flex: 1, marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {/* Accuracy Bar */}
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                                                <span>{t('report.timing_accuracy')}</span>
                                                                <span>{Math.round(data.accuracy)}ms {t('report.avg')}</span>
                                                            </div>
                                                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${Math.max(0, Math.min(100, 100 - (data.accuracy - 20) * (100 / 60)))}%`, // 20ms full, 80ms empty
                                                                    background: 'linear-gradient(90deg, #52c41a, #a0d911)'
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* Stability Bar */}
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                                                <span>{t('report.stability')}</span>
                                                                <span>{Math.round(data.stdDev)}ms</span>
                                                            </div>
                                                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${Math.max(0, Math.min(100, 100 - ((data.stdDev || 0) - 10) * (100 / 40)))}%`, // 10ms full, 50ms empty
                                                                    background: 'linear-gradient(90deg, #1890ff, #69c0ff)'
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* Tendency Bar (Bipolar) */}
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                                                <span>{t('report.tendency')}</span>
                                                                <span style={{
                                                                    color: data.tendency < -5 ? '#fa8c16' : data.tendency > 5 ? '#ff4d4f' : '#52c41a'
                                                                }}>
                                                                    {Math.abs(data.tendency) < 5 ? t('report.just_right') :
                                                                        data.tendency < 0 ? `${t('report.rush')} (${Math.round(data.tendency)}ms)` : `${t('report.drag')} (+${Math.round(data.tendency)}ms)`}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: 'var(--radius-sm)', position: 'relative' }}>
                                                                {/* Center Marker */}
                                                                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#555', transform: 'translateX(-50%)' }} />
                                                                {/* Fill */}
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 0, bottom: 0,
                                                                    left: data.tendency < 0 ? 'auto' : '50%',
                                                                    right: data.tendency < 0 ? '50%' : 'auto',
                                                                    // Scale: 50ms = full width (50%)
                                                                    width: `${Math.min(50, Math.abs(data.tendency) * (50 / 50))}%`,
                                                                    background: data.tendency < 0 ? '#fa8c16' : '#ff4d4f', // Orange for Rush, Red for Drag (or adjust colors?)
                                                                    borderTopLeftRadius: data.tendency < 0 ? 'var(--radius-sm)' : '0',
                                                                    borderBottomLeftRadius: data.tendency < 0 ? 'var(--radius-sm)' : '0',
                                                                    borderTopRightRadius: data.tendency > 0 ? 'var(--radius-sm)' : '0',
                                                                    borderBottomRightRadius: data.tendency > 0 ? 'var(--radius-sm)' : '0',
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* Hit Count Label */}
                                                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                                                            {t('report.hits')}: {data.hitCount}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Timing Deviation Graph */}
                                {lastSessionHits && lastSessionHits.length > 0 && selectedPattern && (
                                    <TimingDeviationGraph
                                        hits={lastSessionHits}
                                        patternLength={selectedPattern.sequence.length}
                                    />
                                )}

                                <WaveformVisualizer
                                    audioBlob={audioBlob}
                                    onsets={onsets}
                                    startTime={startTime}
                                    duration={duration}
                                    audioContext={audioContext}
                                    beatHistory={beatHistory}
                                    audioLatency={audioLatency}
                                />
                            </div>
                        )}

                        {/* 4. Settings (Collapsible) */}

                    </div>
                )
            }

            {
                activeTab === 'history' && (
                    <HistoryView />
                )
            }

            {
                activeTab === 'editor' && (
                    <div style={{ height: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                        <PatternManager onDirtyChange={setEditorIsDirty} />
                    </div>
                )
            }

            {
                activeTab === 'manual' && (
                    <ManualHelper />
                )
            }

            {
                activeTab === 'settings' && (
                    <div style={{ height: 'calc(100vh - 160px)', padding: '0 1rem' }}>
                        <MetronomeSettings
                            currentTheme={theme}
                            onThemeChange={setTheme}
                            visualEffectsEnabled={visualEffectsEnabled}
                            onVisualEffectsChange={setVisualEffectsEnabled}
                            audioLatency={audioLatency}
                            onAudioLatencyChange={setAudioLatency}
                            onRunAutoCalibration={runCalibration}
                            isCalibrating={isCalibrating}
                            micGain={micGain}
                            onMicGainChange={setMicGain}
                            micThreshold={micThreshold}
                            onMicThresholdChange={setMicThreshold}
                            onRunMicCalibration={runMicAutoCalibration}
                            isMicCalibrating={micCalibState.active}
                            outputMode={outputMode}
                            onOutputModeChange={setOutputMode}
                            mediaStream={mediaStream}
                            micError={micError}
                            currentLevel={currentLevel}
                            selectedDeviceId={selectedDeviceId}
                            onDeviceChange={setSelectedDeviceId}
                        />
                    </div>
                )
            }

        </section >
    );
};
