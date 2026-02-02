import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetronome } from '../../hooks/useMetronome';
import { useAudioAnalysis } from '../../hooks/useAudioAnalysis';
import { useRhythmScoring } from '../../hooks/useRhythmScoring';
import { useSessionManager } from '../../hooks/useSessionManager';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { MetronomeSettings } from '../Controls/MetronomeSettings';
import { SubdivisionControl } from '../Controls/SubdivisionControl';
import { GapClickControl } from '../Controls/GapClickControl';
import { type Subdivision } from './MetronomeEngine';
import { PatternVisualizer } from '../Visualizer/PatternVisualizer';
import { WaveformVisualizer } from '../Audio/WaveformVisualizer';
import { HistoryView } from '../Analysis/HistoryView';
import { TimingGauge } from '../Visualizer/TimingGauge';
import { ManualHelper } from '../Manual/ManualHelper';
import { PatternManager } from '../Editor/PatternManager';
import { PATTERNS } from '../../utils/patterns';

export const Metronome: React.FC = () => {
    const { t } = useTranslation();
    // ---- State ----
    const [activeTab, setActiveTab] = useState<'training' | 'history' | 'editor' | 'manual' | 'settings'>(() => {
        const hasLaunched = localStorage.getItem('hasLaunched');
        if (!hasLaunched) {
            localStorage.setItem('hasLaunched', 'true');
            return 'manual';
        }
        return 'training';
    });

    const [selectedPatternId, setSelectedPatternId] = useState(PATTERNS[2].id);
    const selectedPattern = PATTERNS.find(p => p.id === selectedPatternId) || PATTERNS[0];
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

    // Latency State
    const [audioLatency, setAudioLatency] = useState(() => Number(localStorage.getItem('audioLatency') || 0));

    // Mic Settings State
    const [micGain, setMicGain] = useState(() => Number(localStorage.getItem('micGain') || 7.0));
    const [micThreshold, setMicThreshold] = useState(() => Number(localStorage.getItem('micThreshold') || 0.1));

    // Auto Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);

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

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

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
        setSubdivision, setGapClick,
        audioContext,
        initializeAudio
    } = useMetronome();

    const { isMicReady, startAnalysis, stopAnalysis, clearOnsets, onsets, mediaStream, analyzer } = useAudioAnalysis({
        audioContext,
        gain: micGain,
        threshold: micThreshold
    });

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

            // Generate Clicks - MUST match MetronomeEngine sounds
            // MetronomeEngine uses: 1000Hz (count-in), 880Hz (downbeat), 440Hz (quarter), 220Hz (sub)
            // We play 4 clicks representing the loudest sounds user will hear:
            // 1. 1000Hz (count-in), 2. 880Hz (accent/downbeat), 3. 440Hz (normal), 4. 880Hz (accent again)
            const ctx = audioContextRef.current;
            if (ctx) {
                const now = ctx.currentTime;
                const clickConfigs = [
                    { time: now + 0.5, freq: 1000 }, // Count-in sound
                    { time: now + 1.0, freq: 880 },  // Downbeat/Accent
                    { time: now + 1.5, freq: 440 },  // Quarter note
                    { time: now + 2.0, freq: 880 },  // Downbeat again
                ];
                clickConfigs.forEach(({ time, freq }) => {
                    const osc = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    osc.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    osc.frequency.value = freq;
                    // Match MetronomeEngine envelope EXACTLY
                    gainNode.gain.setValueAtTime(0, time);
                    gainNode.gain.linearRampToValueAtTime(1.0, time + 0.001); // Full volume like engine
                    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
                    osc.start(time);
                    osc.stop(time + 0.06);
                });
            }

            // Reset Ref for Bleed measurement
            micCalibRef.current.maxPeak = 0;

            // Poll for 2.5s (covering the clicks)
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

            }, 2500); // 2.5s for Bleed check

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
        // SAFETY MARGIN: Double the threshold multiplier to reduce false positives
        // Old: Max(Floor * 2.5, Signal * 0.15)
        // New: Max(Floor * 4.0, Signal * 0.30) - more conservative
        let targetThreshold = Math.max(projectedFloor * 4.0, projectedSignal * 0.30);
        targetThreshold = Math.max(0.05, Math.min(0.5, targetThreshold)); // Min 0.05 instead of 0.02

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

    // NEW STRATEGY for Calibration:
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

    // Determine Hand
    let currentHand: 'L' | 'R' = 'R';
    if (selectedPattern) {
        let targetStep = currentStep;
        if (closestBeatType === 'next') targetStep += 1;
        // Normalize
        const len = selectedPattern.sequence.length;
        const index = (targetStep % len + len) % len;
        currentHand = selectedPattern.sequence[index];
    }

    // ---- Logic ----
    const { lastSessionStats } = useSessionManager({
        isPlaying,
        bpm,
        patternId: selectedPatternId,
        latestOffsetMs: offsetMs,
        feedback,
        onsetIndex,
        hand: currentHand
    });

    // Session Summary Tab State
    const [summaryTab, setSummaryTab] = useState<'total' | 'left' | 'right'>('total');

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

            if (!disableRecording) {
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
                // If audioContext just got created, useAudioAnalysis needs a render cycle to create analyzer
                let retries = 0;
                while (!micAnalyzerRef.current && retries < 50) {
                    await new Promise(r => setTimeout(r, 50));
                    retries++;
                }

                if (!micAnalyzerRef.current) {
                    alert("Microphone initialization failed. Please try again or use 'No Record' mode.");
                    return; // Do not start
                }

                try {
                    // 3. Request Mic Permission
                    await startAnalysis();
                } catch (e) {
                    console.error("Mic failed", e);
                    alert("Microphone access was denied or failed. Please check permissions.");
                    return; // Do not start
                }
            } else {
                // Even if No Record, ensure AudioContext is ready for playback
                if (!audioContextRef.current) {
                    initializeAudio();
                    await new Promise(r => setTimeout(r, 100)); // Short wait
                }
                if (audioContextRef.current?.state === 'suspended') {
                    try { await audioContextRef.current.resume(); } catch (e) { console.warn(e); }
                }
            }

            // Only reach here if Mic is ready (or disabled)
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

    // Theme Handler (Updated to use state)
    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
    };

    // ---- Render ----
    return (
        <section className="metronome-container" style={{ padding: '1rem 0', width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid var(--color-surface-hover)', padding: '0 0.5rem', gap: '2px' }}>
                {/* Main Tabs */}
                {['training', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab as any)}
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
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t(`tabs.${tab}`)}
                    </button>
                ))}

                {/* Secondary Tabs (Small Icons) */}
                <button
                    onClick={() => handleTabChange('manual')}
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
                </button>
                <button
                    onClick={() => handleTabChange('settings')}
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
                    ⚙
                </button>
                <button
                    onClick={() => handleTabChange('editor')}
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
                    <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>✎</span>
                </button>
            </div>

            {/* Global Calibration Overlays - Visible across all tabs */}
            {(calibrationState.active || micCalibState.active) && (
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
                                    borderRadius: '4px',
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
                                            borderRadius: '4px',
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
                                    borderRadius: '4px',
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
            )}

            {activeTab === 'training' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem', position: 'relative' }}>

                    {/* 1. Pattern Select */}
                    <div>
                        <select
                            value={selectedPatternId}
                            onChange={(e) => setSelectedPatternId(e.target.value)}
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
                            {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Visualizer & Feedback */}
                    <div style={{ position: 'relative' }}>
                        <PatternVisualizer
                            pattern={selectedPattern}
                            currentStep={currentStep}
                            isPlaying={isPlaying}
                            subdivision={subdivision}
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
                        <TimingGauge offsetMs={offsetMs} feedback={feedback} />
                        <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {feedback && (
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: feedback === 'Perfect' ? 'var(--color-success)' : feedback === 'Good' ? 'var(--color-accent)' : 'var(--color-error)' }}>
                                    {Math.round(Math.abs(offsetMs))}ms
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
                        overflow: 'hidden',
                        border: '1.5px solid var(--color-border)'
                    }}>
                        {/* Left: Start/Stop Button */}
                        <div style={{
                            flex: '0 0 80px',
                            borderRight: '1.5px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <button
                                onClick={toggle}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: isPlaying ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                                    color: isPlaying ? 'var(--color-accent)' : '#fff',
                                    border: 'none',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                            >
                                {isPlaying ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                            {/* No Rec Toggle (compact) */}
                            <label style={{
                                fontSize: '0.85rem',
                                color: 'var(--color-text-dim)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '4px',
                                background: 'var(--color-surface)',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={disableRecording}
                                    onChange={e => setDisableRecording(e.target.checked)}
                                    style={{ margin: 0, transform: 'scale(0.8)' }}
                                />
                                NoRec
                            </label>
                        </div>

                        {/* Right: Tempo Controls */}
                        <div style={{ flex: 1, padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>

                            {/* NEW: Subdivision & GapClick & TEMPO Label */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
                                <SubdivisionControl
                                    subdivision={subdivision}
                                    onChange={handleSubdivisionChange}
                                />
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontWeight: 'bold', letterSpacing: '1px' }}>TEMPO</div>
                                <GapClickControl
                                    enabled={gapEnabled}
                                    playBars={playBars}
                                    muteBars={muteBars}
                                    onChange={handleGapClickChange}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                                <button onClick={() => changeBpm(bpm - 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.85rem' }}>-10</button>
                                <button onClick={() => changeBpm(bpm - 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.85rem' }}>-1</button>

                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-primary)', minWidth: '60px', textAlign: 'center', margin: '0 4px' }}>
                                    {bpm}
                                </div>

                                <button onClick={() => changeBpm(bpm + 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.85rem' }}>+1</button>
                                <button onClick={() => changeBpm(bpm + 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.85rem' }}>+10</button>
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
                                        {(['total', 'left', 'right'] as const).map(t => {
                                            const label = t === 'total' ? 'TOTAL' : t === 'left' ? 'LEFT (L)' : 'RIGHT (R)';
                                            const isActive = summaryTab === t;
                                            const hasData = t === 'total' || (t === 'left' && lastSessionStats.left) || (t === 'right' && lastSessionStats.right);

                                            if (!hasData) return null;

                                            return (
                                                <button
                                                    key={t}
                                                    onClick={() => setSummaryTab(t)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.4rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        border: 'none',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: isActive ? 'var(--color-primary)' : 'transparent',
                                                        color: isActive ? '#000' : 'var(--color-text-dim)',
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

                                        if (!data) return <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>No Data</div>;

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
                                                        {data.score} <span style={{ fontSize: '0.7rem' }}>pts</span>
                                                    </div>
                                                </div>

                                                {/* Right: Metrics Bars */}
                                                <div style={{ flex: 1, marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {/* Accuracy Bar */}
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                                            <span>TIMING ACCURACY</span>
                                                            <span>{Math.round(data.accuracy)}ms avg</span>
                                                        </div>
                                                        <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
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
                                                            <span>STABILITY (SD)</span>
                                                            <span>{Math.round(data.stdDev)}ms</span>
                                                        </div>
                                                        <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
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
                                                            <span>TENDENCY</span>
                                                            <span style={{
                                                                color: data.tendency < -5 ? '#fa8c16' : data.tendency > 5 ? '#ff4d4f' : '#52c41a'
                                                            }}>
                                                                {Math.abs(data.tendency) < 5 ? 'Just Right' :
                                                                    data.tendency < 0 ? `Rush (${Math.round(data.tendency)}ms)` : `Drag (+${Math.round(data.tendency)}ms)`}
                                                            </span>
                                                        </div>
                                                        <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', position: 'relative' }}>
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
                                                                borderTopLeftRadius: data.tendency < 0 ? '3px' : '0',
                                                                borderBottomLeftRadius: data.tendency < 0 ? '3px' : '0',
                                                                borderTopRightRadius: data.tendency > 0 ? '3px' : '0',
                                                                borderBottomRightRadius: data.tendency > 0 ? '3px' : '0',
                                                            }} />
                                                        </div>
                                                    </div>

                                                    {/* Hit Count Label */}
                                                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                                                        Hits: {data.hitCount}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
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
            )}

            {activeTab === 'history' && (
                <HistoryView />
            )}

            {activeTab === 'editor' && (
                <div style={{ height: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                    <PatternManager onDirtyChange={setEditorIsDirty} />
                </div>
            )}

            {activeTab === 'manual' && (
                <ManualHelper />
            )}

            {activeTab === 'settings' && (
                <div style={{ height: 'calc(100vh - 160px)', padding: '0 1rem' }}>
                    <MetronomeSettings
                        currentTheme={theme}
                        onThemeChange={handleThemeChange}
                        audioLatency={audioLatency}
                        onAudioLatencyChange={setAudioLatency}
                        onRunAutoCalibration={runCalibration}
                        isCalibrating={calibrationState.active}
                        micGain={micGain}
                        onMicGainChange={setMicGain}
                        micThreshold={micThreshold}
                        onMicThresholdChange={setMicThreshold}
                        onRunMicCalibration={runMicAutoCalibration}
                        isMicCalibrating={micCalibState.active}
                    />
                </div>
            )}

        </section>
    );
};
