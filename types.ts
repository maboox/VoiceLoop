export enum PlaybackMode {
  LOOP = 'LOOP',
  ONE_SHOT = 'ONE_SHOT',
  INTERVAL = 'INTERVAL', // Plays every X seconds or Beats
}

export interface PadConfig {
  id: string;
  label: string;
  keyShortcut: string;
  color: string;
  volume: number;
  playbackMode: PlaybackMode;
  
  // Interval Logic
  intervalSeconds: number; // Used if useBeats is false
  useBeats: boolean;       // If true, use beatAmount based on global BPM
  beatAmount: number;      // e.g. 0.5 (half beat), 1 (quarter note), 4 (1 bar)

  // Playback Logic
  isRetrigger: boolean;    // If true, clicking while playing restarts immediately (cuts off previous)
  
  // FX & Pitch
  playbackRate: number;    // 0.5 to 2.0 (Pitch/Speed)
  fxFilterVal: number;     // -1 (Low Pass) to 0 (None) to 1 (High Pass)
}

export interface PadState {
  isRecording: boolean;
  isPlaying: boolean;
  hasAudio: boolean;
  audioBuffer: AudioBuffer | null;
}

// Combine config and runtime state for the UI
export interface PadData extends PadConfig, PadState {}

export interface AudioEngineContextType {
  audioContext: AudioContext | null;
  masterGain: GainNode | null;
  registerPad: (id: string, buffer: AudioBuffer) => void;
  playPad: (id: string) => void;
  stopPad: (id: string) => void;
  toggleRecordPad: (id: string, deviceId?: string) => Promise<void>;
  updatePadVolume: (id: string, val: number) => void;
  startMasterRecording: () => void;
  stopMasterRecording: () => Promise<Blob | null>;
  isMasterRecording: boolean;
}