import React from 'react';
import { Circle, StopCircle, Square, Mic, Activity } from 'lucide-react';

interface ControlsProps {
  isMasterRecording: boolean;
  onMasterRecordToggle: () => void;
  onStopAll: () => void;
  bpm: number;
  onBpmChange: (val: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isMasterRecording,
  onMasterRecordToggle,
  onStopAll,
  bpm,
  onBpmChange
}) => {
  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-40 shadow-2xl gap-4">
      
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-r from-neon-blue to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg shadow-neon-blue/20">
            <Mic className="text-white w-6 h-6" />
        </div>
        <div>
           <h1 className="text-xl font-bold tracking-tight text-white leading-none">VoiceLoop <span className="text-neon-blue">DJ</span></h1>
           <p className="text-[10px] text-gray-500 uppercase tracking-widest hidden sm:block">Sampler & Sequencer</p>
        </div>
      </div>

      {/* BPM Control */}
      <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-full border border-gray-700">
        <Activity size={16} className="text-neon-green animate-pulse" />
        <span className="text-xs font-bold text-gray-400">BPM</span>
        <input 
          type="range" 
          min="60" max="200" 
          value={bpm} 
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="w-24 accent-neon-green h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <input 
          type="number"
          min="60" max="200"
          value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="w-12 bg-gray-900 border border-gray-600 rounded text-center text-sm font-mono text-white focus:border-neon-green focus:outline-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Stop All Button */}
        <button
          onClick={onStopAll}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700 font-medium text-sm active:scale-95"
        >
          <Square size={16} fill="currentColor" /> <span className="hidden sm:inline">Stop All</span>
        </button>

        {/* Master Record Button */}
        <button
          onClick={onMasterRecordToggle}
          className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all duration-300 shadow-lg ${
            isMasterRecording 
              ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' 
              : 'bg-white text-black hover:bg-gray-200'
          }`}
        >
          {isMasterRecording ? (
            <>
              <StopCircle size={18} /> <span className="hidden sm:inline">Stop REC</span>
            </>
          ) : (
            <>
              <Circle size={18} fill="currentColor" className="text-red-500" /> REC Mix
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Controls;