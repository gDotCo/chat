
import React from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';
import { IncomingCallInfo } from '../hooks/useWebRTC';

interface IncomingCallViewProps {
  callInfo: IncomingCallInfo;
  onAccept: () => void;
  onReject: () => void;
}

const getCallTypeInfo = (callType: string) => {
    switch (callType) {
        case 'video': return { icon: ICON_PATHS.video, name: 'Video Call' };
        case 'voice': return { icon: ICON_PATHS.phone, name: 'Voice Call' };
        case 'canvas': return { icon: ICON_PATHS.pen, name: 'Canvas Session' };
        default: return { icon: ICON_PATHS.chat, name: 'Call' };
    }
}

export const IncomingCallView: React.FC<IncomingCallViewProps> = ({ callInfo, onAccept, onReject }) => {
  const { icon, name } = getCallTypeInfo(callInfo.callType);
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-dark-surface rounded-b-lg p-8">
      <div className="text-center">
        <div className="relative inline-block animate-pulse">
          <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center">
            <Icon path={icon} className="w-20 h-20 text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mt-6 text-dark-text-primary">Incoming {name}</h2>
        <p className="text-dark-text-secondary mt-2">
            You have an incoming call from your peer.
        </p>
      </div>
      
      <div className="mt-12 flex justify-center items-center gap-6">
        <button
          onClick={onReject}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          aria-label="Reject Call"
        >
          <Icon path={ICON_PATHS.hangup} className="w-8 h-8" />
        </button>
        <button
          onClick={onAccept}
          className="p-4 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
          aria-label="Accept Call"
        >
          <Icon path={ICON_PATHS.phone} className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
