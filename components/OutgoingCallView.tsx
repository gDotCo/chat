
import React from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface OutgoingCallViewProps {
  onCancel: () => void;
}

export const OutgoingCallView: React.FC<OutgoingCallViewProps> = ({ onCancel }) => {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-dark-surface rounded-b-lg p-8">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
            <Icon path={ICON_PATHS.phone} className="w-20 h-20 text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mt-6 text-dark-text-primary">Calling Peer...</h2>
        <p className="text-dark-text-secondary mt-2">
            Waiting for your peer to answer.
        </p>
      </div>
      
      <div className="mt-12 flex justify-center items-center gap-6">
        <button
          onClick={onCancel}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          aria-label="Cancel Call"
        >
          <Icon path={ICON_PATHS.hangup} className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
