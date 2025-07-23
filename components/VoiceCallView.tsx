import React, { useRef, useEffect } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface VoiceCallViewProps {
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}

export const VoiceCallView: React.FC<VoiceCallViewProps> = ({
  remoteStream,
  isMuted,
  onToggleMute,
  onHangUp,
}) => {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-dark-surface rounded-b-lg p-8">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center">
            <Icon path={ICON_PATHS.phone} className="w-20 h-20 text-blue-400" />
          </div>
          {remoteStream && <span className="absolute bottom-0 right-0 block h-8 w-8 rounded-full bg-green-500 border-4 border-dark-surface animate-pulse" />}
        </div>
        <h2 className="text-2xl font-bold mt-6 text-dark-text-primary">Voice Call in Progress</h2>
        <p className="text-dark-text-secondary mt-2">
            {remoteStream ? 'You are connected to your peer.' : 'Waiting for peer to connect...'}
        </p>
      </div>
      
      {/* Controls */}
      <div className="mt-12 flex justify-center items-center gap-6">
        <button
          onClick={onToggleMute}
          className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <Icon path={isMuted ? ICON_PATHS.micOff : ICON_PATHS.mic} className="w-8 h-8"/>
        </button>
        <button
          onClick={onHangUp}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          aria-label="Hang up"
        >
          <Icon path={ICON_PATHS.hangup} className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
