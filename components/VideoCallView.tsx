
import React, { useRef, useEffect } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface VideoCallViewProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onHangUp: () => void;
}

export const VideoCallView: React.FC<VideoCallViewProps> = ({
  localStream,
  remoteStream,
  isMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
  onHangUp
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="relative h-full w-full bg-black rounded-b-lg overflow-hidden">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
       {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <Icon path={ICON_PATHS.video} className="w-16 h-16 mx-auto text-gray-500"/>
            <p className="mt-2 text-dark-text-secondary">Waiting for peer to connect...</p>
          </div>
        </div>
      )}

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute bottom-4 right-4 w-1/4 max-w-[200px] rounded-lg border-2 border-dark-border shadow-lg"
        style={{ display: localStream ? 'block' : 'none' }}
      />
      {!localStream && (
          <div className="absolute bottom-4 right-4 w-1/4 max-w-[200px] h-auto aspect-video rounded-lg border-2 border-dark-border bg-gray-800 flex items-center justify-center">
            <Icon path={ICON_PATHS.videoOff} className="w-8 h-8 text-gray-500" />
          </div>
      )}


      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-center items-center gap-4">
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <Icon path={isMuted ? ICON_PATHS.micOff : ICON_PATHS.mic} />
        </button>
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-full transition-colors ${!isVideoEnabled ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          aria-label={!isVideoEnabled ? 'Enable Video' : 'Disable Video'}
        >
          <Icon path={!isVideoEnabled ? ICON_PATHS.videoOff : ICON_PATHS.video} />
        </button>
        <button
          onClick={onHangUp}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          aria-label="Hang up"
        >
          <Icon path={ICON_PATHS.hangup} />
        </button>
      </div>
    </div>
  );
};
