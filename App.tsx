import React, { useState, useEffect, useRef } from 'react';
import { PlaybackMode, PadConfig, PadData } from './types';
import { DEFAULT_PAD_CONFIGS } from './constants';
import Pad from './components/Pad';
import Controls from './components/Controls';

export default function App() {
  // Global State
  const [bpm, setBpm] = useState(120);

  // State for all pads (combining config and runtime state)
  const [pads, setPads] = useState<PadData[]>(() => 
    DEFAULT_PAD_CONFIGS.map(c => ({
      ...c,
      isRecording: false,
      isPlaying: false,
      hasAudio: false,
      audioBuffer: null
    }))
  );

  const [isMasterRecording, setIsMasterRecording] = useState(false);
  
  // -- Audio Engine Refs --
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const masterRecorderRef = useRef<MediaRecorder | null>(null);
  const masterChunksRef = useRef<Blob[]>([]);

  // Resource Maps
  const padBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map()); // For Loop/OneShot sources
  const activeIntervalsRef = useRef<Map<string, number>>(new Map()); // For Interval mode timer IDs
  const padGainsRef = useRef<Map<string, GainNode>>(new Map()); // Volume control per pad
  const padFiltersRef = useRef<Map<string, BiquadFilterNode>>(new Map()); // Filter FX per pad
  const padRecordersRef = useRef<Map<string, MediaRecorder>>(new Map()); // Recording instances

  // -- Initialization --
  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      
      // Destination for Master Recording
      const dest = ctx.createMediaStreamDestination();
      masterGain.connect(dest);

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      masterDestRef.current = dest;
    } else if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    const init = () => ensureAudioContext();
    window.addEventListener('click', init, { once: true });
    window.addEventListener('keydown', init, { once: true });
    return () => {
      window.removeEventListener('click', init);
      window.removeEventListener('keydown', init);
    };
  }, []);

  // -- Helper: Calculate Filter values based on -1 to 1 input --
  const applyFilterValues = (filterNode: BiquadFilterNode, val: number, ctx: AudioContext) => {
    // val: -1 (Low Pass) ... 0 (Open) ... 1 (High Pass)
    const currentTime = ctx.currentTime;
    
    if (val === 0) {
      // "Open" sound - set frequency to limits based on type to effectively bypass
      // However, changing type abruptly can cause clicks. 
      // We will default to Lowpass at 20kHz (effectively open) when near 0.
      filterNode.type = 'lowpass';
      filterNode.frequency.setTargetAtTime(22000, currentTime, 0.1);
      filterNode.Q.value = 0.1;
    } else if (val < 0) {
      // Low Pass (Muffled)
      // Map -0.1 -> -1 to 20000Hz -> 100Hz
      filterNode.type = 'lowpass';
      // Logarithmic scale approximation
      const minFreq = 100;
      const maxFreq = 20000;
      const percent = 1 - Math.abs(val); // 1 = max freq, 0 = min freq
      const freq = minFreq * Math.pow(maxFreq / minFreq, percent);
      
      filterNode.frequency.setTargetAtTime(freq, currentTime, 0.1);
      filterNode.Q.value = 1 + (Math.abs(val) * 2); // Add some resonance as we sweep
    } else {
      // High Pass (Thin)
      // Map 0.1 -> 1 to 20Hz -> 5000Hz
      filterNode.type = 'highpass';
      const minFreq = 20;
      const maxFreq = 8000;
      const percent = Math.abs(val);
      const freq = minFreq * Math.pow(maxFreq / minFreq, percent);
      
      filterNode.frequency.setTargetAtTime(freq, currentTime, 0.1);
      filterNode.Q.value = 1 + (Math.abs(val) * 2);
    }
  };

  // -- Pad Logic --

  const stopPadPlayback = (id: string, updateState = true) => {
    // 1. Stop Source
    const source = activeSourcesRef.current.get(id);
    if (source) {
      try { source.stop(); } catch(e) {}
      source.disconnect();
      activeSourcesRef.current.delete(id);
    }

    // 2. Clear Interval
    const timer = activeIntervalsRef.current.get(id);
    if (timer) {
      clearInterval(timer);
      activeIntervalsRef.current.delete(id);
    }

    if (updateState) {
      setPads(prev => prev.map(p => p.id === id ? { ...p, isPlaying: false } : p));
    }
  };

  const playPad = (id: string, modeOverride?: PlaybackMode) => {
    const ctx = ensureAudioContext();
    const pad = pads.find(p => p.id === id);
    if (!pad || !padBuffersRef.current.has(id)) return;

    const buffer = padBuffersRef.current.get(id)!;
    const mode = modeOverride || pad.playbackMode;
    
    // Calculate Interval duration
    const intervalDuration = pad.useBeats 
        ? (60 / bpm) * pad.beatAmount 
        : pad.intervalSeconds;

    // Retrigger Logic
    if (pad.isRetrigger || pad.isPlaying) {
         stopPadPlayback(id, false); 
    }

    const playSource = () => {
      if (!padBuffersRef.current.has(id)) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pad.playbackRate; // Apply Pitch

      // Filter Node (FX)
      let filter = padFiltersRef.current.get(id);
      if (!filter) {
        filter = ctx.createBiquadFilter();
        padFiltersRef.current.set(id, filter);
      }
      // Reset connection chain logic for new source
      // Chain: Source -> Filter -> Gain -> Master
      applyFilterValues(filter, pad.fxFilterVal, ctx);

      // Gain Node (Volume)
      let gain = padGainsRef.current.get(id);
      if (!gain) {
        gain = ctx.createGain();
        padGainsRef.current.set(id, gain);
      }
      gain.gain.value = pad.volume;
      gain.connect(masterGainRef.current!); // Ensure gain connects to master

      // Connections
      source.connect(filter);
      filter.connect(gain);
      // gain is already connected to master

      if (mode === PlaybackMode.LOOP) {
        source.loop = true;
        activeSourcesRef.current.set(id, source);
        source.start(0);
      } else if (mode === PlaybackMode.ONE_SHOT || mode === PlaybackMode.INTERVAL) {
        source.start(0);
        activeSourcesRef.current.set(id, source); 
        
        source.onended = () => {
           if (activeSourcesRef.current.get(id) === source) {
                activeSourcesRef.current.delete(id);
                // Note: We don't disconnect filter/gain here so they can be reused/adjusted, 
                // but usually fine to leave connected to graph until cleared.
                if (mode === PlaybackMode.ONE_SHOT) {
                    setPads(prev => prev.map(p => p.id === id ? { ...p, isPlaying: false } : p));
                }
           }
        };
      }
    };

    if (mode === PlaybackMode.INTERVAL) {
      playSource(); 
      const timerId = window.setInterval(playSource, intervalDuration * 1000);
      activeIntervalsRef.current.set(id, timerId);
    } else {
      playSource();
    }

    setPads(prev => prev.map(p => p.id === id ? { ...p, isPlaying: true, playbackMode: mode } : p));
  };

  const togglePadRecord = async (id: string) => {
    const ctx = ensureAudioContext();
    const pad = pads.find(p => p.id === id);
    if (!pad) return;

    if (pad.isRecording) {
      const recorder = padRecordersRef.current.get(id);
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      setPads(prev => prev.map(p => p.id === id ? { ...p, isRecording: false } : p));
    } else {
      try {
        if (pad.isPlaying) stopPadPlayback(id); 

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
           const blob = new Blob(chunks, { type: 'audio/webm' });
           const arrayBuffer = await blob.arrayBuffer();
           const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
           padBuffersRef.current.set(id, audioBuffer);
           
           setPads(prev => prev.map(p => p.id === id ? { ...p, hasAudio: true, audioBuffer } : p));
           stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        padRecordersRef.current.set(id, recorder);
        setPads(prev => prev.map(p => p.id === id ? { ...p, isRecording: true } : p));

      } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Please allow microphone access to record.");
      }
    }
  };

  const handlePlayToggle = (id: string, modeOverride?: PlaybackMode) => {
    const pad = pads.find(p => p.id === id);
    if (!pad) return;

    if (modeOverride || (pad.isPlaying && pad.isRetrigger)) {
      playPad(id, modeOverride);
      return;
    }

    if (pad.isPlaying) {
      stopPadPlayback(id);
    } else {
      playPad(id);
    }
  };

  const handleClearPad = (id: string) => {
    stopPadPlayback(id);
    padBuffersRef.current.delete(id);
    padFiltersRef.current.delete(id);
    padGainsRef.current.delete(id);
    setPads(prev => prev.map(p => p.id === id ? { ...p, hasAudio: false, audioBuffer: null, isPlaying: false } : p));
  };

  const handleUpdateConfig = (id: string, config: Partial<PadConfig>) => {
    setPads(prev => prev.map(p => p.id === id ? { ...p, ...config } : p));
    
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Live Volume Update
    if (config.volume !== undefined) {
      const gain = padGainsRef.current.get(id);
      if (gain) {
        gain.gain.setTargetAtTime(config.volume, ctx.currentTime, 0.1);
      }
    }

    // Live Pitch Update
    if (config.playbackRate !== undefined) {
       const source = activeSourcesRef.current.get(id);
       if (source) {
          source.playbackRate.setTargetAtTime(config.playbackRate, ctx.currentTime, 0.1);
       }
    }

    // Live Filter Update
    if (config.fxFilterVal !== undefined) {
       // Ensure filter exists (it usually does if playing, if not it will be created on next play)
       let filter = padFiltersRef.current.get(id);
       if (!filter) {
         filter = ctx.createBiquadFilter();
         padFiltersRef.current.set(id, filter);
       }
       applyFilterValues(filter, config.fxFilterVal, ctx);
    }
  };

  // -- Master Recording --
  const toggleMasterRecord = () => {
    const ctx = ensureAudioContext();
    if (isMasterRecording) {
        if (masterRecorderRef.current && masterRecorderRef.current.state !== 'inactive') {
            masterRecorderRef.current.stop();
        }
        setIsMasterRecording(false);
    } else {
        if (!masterDestRef.current) return;
        masterChunksRef.current = [];
        const recorder = new MediaRecorder(masterDestRef.current.stream);
        
        recorder.ondataavailable = (e) => masterChunksRef.current.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(masterChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `voiceloop-mix-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        };

        recorder.start();
        masterRecorderRef.current = recorder;
        setIsMasterRecording(true);
    }
  };

  const stopAll = () => {
    pads.forEach(p => {
        if (p.isPlaying) stopPadPlayback(p.id);
        if (p.isRecording) togglePadRecord(p.id);
    });
  };

  // -- Keyboard Shortcuts --
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;

        let mappedKey = '';
        if (e.code.startsWith('Digit')) mappedKey = e.code.replace('Digit', '');
        else if (e.code.startsWith('Key')) mappedKey = e.code.replace('Key', '');
        else if (e.code === 'Comma') mappedKey = ',';
        else mappedKey = e.key.toUpperCase();

        const pad = pads.find(p => p.keyShortcut === mappedKey);
        
        if (pad) {
            e.preventDefault();
            if (e.shiftKey) {
                if (pad.isPlaying) stopPadPlayback(pad.id);
                if (pad.isRecording) togglePadRecord(pad.id);
            } else {
                if (pad.isRecording) togglePadRecord(pad.id);
                else handlePlayToggle(pad.id);
            }
        }
        
        if (e.code === 'Space') {
            e.preventDefault();
            stopAll();
        }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pads, bpm]); 

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-neon-pink selection:text-white pb-20">
      <Controls 
        isMasterRecording={isMasterRecording} 
        onMasterRecordToggle={toggleMasterRecord}
        onStopAll={stopAll}
        bpm={bpm}
        onBpmChange={setBpm}
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center">
        
        {/* Help Text */}
        <div className="w-full text-center mb-6 space-y-1 text-gray-500 text-xs md:text-sm">
           <p>Click pad to <span className="text-red-400">Record</span> or <span className="text-neon-blue">Play</span>.</p>
           <p>
             <span className="font-bold text-gray-300">Shift + Key</span> to Stop.
             <span className="mx-2">|</span>
             <span className="font-bold text-gray-300">Ctrl + Click</span> for Interval.
           </p>
        </div>

        {/* Grid Responsive Upgrade */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 w-full">
          {pads.map(pad => (
            <Pad
              key={pad.id}
              config={pad}
              state={pad}
              bpm={bpm}
              onRecordToggle={() => togglePadRecord(pad.id)}
              onPlayToggle={(mode) => handlePlayToggle(pad.id, mode)}
              onClear={() => handleClearPad(pad.id)}
              onUpdateConfig={(conf) => handleUpdateConfig(pad.id, conf)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}