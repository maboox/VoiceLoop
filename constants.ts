import { PadConfig, PlaybackMode } from './types';

export const GRID_SIZE = 24;

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500', 'bg-slate-500'
];

const KEYS = ['1','2','3','4','Q','W','E','R','A','S','D','F','Z','X','C','V','G','H','J','K','B','N','M',','];

export const DEFAULT_PAD_CONFIGS: PadConfig[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `pad-${i + 1}`,
  label: `Pad ${i + 1}`,
  keyShortcut: KEYS[i] || '',
  color: COLORS[i % COLORS.length],
  volume: 1.0,
  playbackMode: i < 4 ? PlaybackMode.LOOP : PlaybackMode.ONE_SHOT, // First 4 loops by default
  intervalSeconds: 2,
  useBeats: true, // Default to using BPM
  beatAmount: 4,  // Default to 1 Bar (4 beats)
  isRetrigger: false, // Default to NOT cut-self behavior
  playbackRate: 1.0,
  fxFilterVal: 0, // 0 means neutral (no filter effect)
}));