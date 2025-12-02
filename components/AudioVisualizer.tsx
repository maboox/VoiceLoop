import React from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  colorClass: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, colorClass }) => {
  if (!isPlaying) return null;

  return (
    <div className="flex items-end justify-center gap-1 h-4 w-full opacity-80">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1 rounded-t-sm ${colorClass} animate-pulse`}
          style={{
            height: '100%',
            animationDuration: `${0.2 + i * 0.1}s`,
            animationName: 'bounce' // Using default bounce or custom keyframe if defined
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;