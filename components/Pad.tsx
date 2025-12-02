import React, { useRef, useState, useEffect } from 'react';
import { Mic, Square, Play, Repeat, Clock, MoreVertical, Zap, Trash2, Gauge, Sliders, Volume2 } from 'lucide-react';
import { PadConfig, PadState, PlaybackMode } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface PadProps {
  config: PadConfig;
  state: PadState;
  bpm: number; // passed to calculate display time
  onRecordToggle: () => void;
  onPlayToggle: (modeOverride?: PlaybackMode) => void;
  onClear: () => void;
  onUpdateConfig: (newConfig: Partial<PadConfig>) => void;
}

const Pad: React.FC<PadProps> = ({
  config,
  state,
  bpm,
  onRecordToggle,
  onPlayToggle,
  onClear,
  onUpdateConfig,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMainClick = (e: React.MouseEvent) => {
    // If holding Ctrl or Cmd, trigger Interval mode temporarily or toggle play
    if (e.ctrlKey || e.metaKey) {
       onUpdateConfig({ playbackMode: PlaybackMode.INTERVAL });
       onPlayToggle(PlaybackMode.INTERVAL);
       return;
    }

    if (state.isRecording) {
      onRecordToggle();
    } else if (state.hasAudio) {
      onPlayToggle();
    } else {
      onRecordToggle();
    }
  };

  const getStatusIcon = () => {
    if (state.isRecording) return <Square className="w-8 h-8 animate-pulse text-red-500 fill-current" />;
    if (state.isPlaying) return <Square className="w-8 h-8 text-white fill-current" />;
    if (state.hasAudio) return <Play className="w-8 h-8 text-white fill-current" />;
    return <Mic className="w-8 h-8 text-gray-400" />;
  };

  const getModeIcon = () => {
    switch (config.playbackMode) {
      case PlaybackMode.LOOP: return <Repeat size={14} />;
      case PlaybackMode.INTERVAL: return <Clock size={14} />;
      default: return null;
    }
  };

  // Dynamic Styles
  const baseClasses = "relative w-full aspect-square rounded-xl transition-all duration-100 flex flex-col items-center justify-center select-none cursor-pointer border-2 group active:scale-[0.98]";
  
  let stateClasses = "bg-gray-800 border-gray-700 hover:border-gray-500"; // Empty state
  
  if (state.hasAudio) {
    stateClasses = `bg-gray-750 border-${config.color.replace('bg-', '')}`;
    if (state.isPlaying) {
      // Glow effect based on color
      stateClasses += ` border-transparent ring-2 ring-offset-2 ring-offset-gray-900 ring-${config.color.replace('bg-', '')}`;
      if (config.playbackMode === PlaybackMode.INTERVAL) {
          stateClasses += " animate-pulse-fast";
      }
    }
  }

  if (state.isRecording) {
    stateClasses = "bg-red-900/20 border-red-500 ring-2 ring-red-500 ring-opacity-50 animate-pulse";
  }

  // Calculate beat duration for display
  const beatDuration = (60 / bpm) * config.beatAmount;
  const displayInterval = config.useBeats ? `${beatDuration.toFixed(2)}s` : `${config.intervalSeconds}s`;

  // Fix Z-Index: When settings are open, lift this pad above others
  const zIndexClass = showSettings ? 'z-50' : 'z-auto';

  return (
    <div className={`${stateClasses} ${baseClasses} ${zIndexClass}`} onClick={handleMainClick}>
      {/* Keyboard Shortcut Indicator */}
      <div className="absolute top-2 left-2 text-[10px] font-mono font-bold text-gray-500 bg-gray-900/80 px-1.5 py-0.5 rounded border border-gray-700/50">
        {config.keyShortcut}
      </div>

      {/* Mode Indicator */}
      {state.hasAudio && (
        <div className="absolute top-2 right-2 text-gray-400 flex items-center gap-1">
          {config.isRetrigger && <Zap size={10} className="text-yellow-500" />}
          {getModeIcon()}
        </div>
      )}

      {/* Main Icon / Content */}
      <div className="z-10 flex flex-col items-center gap-1">
        {getStatusIcon()}
        <span className={`text-xs font-bold truncate max-w-[80px] ${state.hasAudio ? 'text-gray-200' : 'text-gray-500'}`}>
          {state.isRecording ? 'REC' : config.label}
        </span>
        {state.hasAudio && config.playbackMode === PlaybackMode.INTERVAL && (
            <span className="text-[10px] text-neon-green font-mono">{config.useBeats ? `${config.beatAmount} Beats` : displayInterval}</span>
        )}
      </div>

      {/* Playing Visualizer */}
      <div className="absolute bottom-4 w-1/2">
        <AudioVisualizer isPlaying={state.isPlaying} colorClass={config.color} />
      </div>

      {/* Settings / Menu Button */}
      <button 
        className="absolute bottom-1 right-1 p-1.5 rounded-full hover:bg-gray-700 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setShowSettings(!showSettings);
        }}
      >
        <MoreVertical size={14} />
      </button>

      {/* Context Menu / Settings Panel */}
      {showSettings && (
        <div 
          ref={settingsRef}
          className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 flex flex-col gap-3 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Playback Mode */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Mode</div>
            <div className="flex gap-1 bg-gray-900 p-1 rounded">
              {[PlaybackMode.ONE_SHOT, PlaybackMode.LOOP, PlaybackMode.INTERVAL].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateConfig({ playbackMode: mode })}
                  className={`flex-1 p-1 rounded text-[10px] uppercase font-bold text-center ${config.playbackMode === mode ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {mode === PlaybackMode.ONE_SHOT ? 'Shot' : mode === PlaybackMode.LOOP ? 'Loop' : 'Intvl'}
                </button>
              ))}
            </div>
          </div>

          {/* Retrigger Toggle */}
          <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">Retrigger (Cut)</span>
              <button 
                onClick={() => onUpdateConfig({ isRetrigger: !config.isRetrigger })}
                className={`w-8 h-4 rounded-full relative transition-colors ${config.isRetrigger ? 'bg-neon-green' : 'bg-gray-600'}`}
              >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.isRetrigger ? 'left-4.5' : 'left-0.5'}`} style={{ left: config.isRetrigger ? 'calc(100% - 14px)' : '2px' }}/>
              </button>
          </div>

          <div className="h-px bg-gray-700" />
           
           {/* Volume Control */}
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <Volume2 size={12} className="text-gray-400" />
                 <input 
                    type="range" 
                    min="0" max="1.5" step="0.05" 
                    value={config.volume}
                    onChange={(e) => onUpdateConfig({ volume: parseFloat(e.target.value) })}
                    className="flex-1 accent-white h-1 bg-gray-600 rounded-lg appearance-none"
                 />
                 <span className="text-[10px] w-6 text-right font-mono">{(config.volume * 100).toFixed(0)}%</span>
              </div>
           </div>

           <div className="h-px bg-gray-700" />

           {/* FX Section */}
           <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                 <Sliders size={10} /> FX / Pitch
              </div>
              
              {/* Pitch / Speed */}
              <div className="flex items-center gap-2 mb-2">
                 <Gauge size={12} className="text-neon-blue" />
                 <input 
                    type="range" 
                    min="0.5" max="2.0" step="0.1" 
                    value={config.playbackRate}
                    onChange={(e) => onUpdateConfig({ playbackRate: parseFloat(e.target.value) })}
                    className="flex-1 accent-neon-blue h-1 bg-gray-600 rounded-lg appearance-none"
                 />
                 <span className="text-[10px] w-6 text-right font-mono">{config.playbackRate.toFixed(1)}x</span>
              </div>

              {/* Filter: Low Pass (-1) <-> High Pass (1) */}
              <div className="flex items-center gap-2">
                 <span className="text-[10px] text-gray-500 font-mono w-3">LP</span>
                 <input 
                    type="range" 
                    min="-1" max="1" step="0.1" 
                    value={config.fxFilterVal}
                    onChange={(e) => onUpdateConfig({ fxFilterVal: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500 h-1 bg-gray-600 rounded-lg appearance-none"
                 />
                 <span className="text-[10px] text-gray-500 font-mono w-3 text-right">HP</span>
              </div>
           </div>

           <div className="h-px bg-gray-700" />

           {/* Clear Pad */}
           <button 
              onClick={() => {
                  onClear();
                  setShowSettings(false);
              }}
              className="flex items-center justify-center gap-2 w-full p-2 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-colors text-xs font-bold uppercase"
           >
               <Trash2 size={12} /> Clear Pad
           </button>
        </div>
      )}
    </div>
  );
};

export default Pad;