
import React, { useState, useMemo, useEffect } from 'react';
import * as Ably from 'ably';
import { Realtime } from 'ably';
import { useWebRTC } from './hooks/useWebRTC';
import { View } from './types';
import { RoomConnector } from './components/ConnectionManager'; // Now imports RoomConnector
import { ChatView } from './components/ChatView';
import { VideoCallView } from './components/VideoCallView';
import { VoiceCallView } from './components/VoiceCallView';
import Icon from './components/Icon';
import { ICON_PATHS } from './constants';

// Extend ImportMeta type for Vite env variables
declare global {
  interface ImportMeta {
    readonly env: {
      VITE_ABLY_KEY: string;
      [key: string]: any;
    };
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [ably, setAbly] = useState< Ably.Realtime | null>(null);
  const [ablyError, setAblyError] = useState<string | null>(null);

  useEffect(() => {
    // IMPORTANT: You must create a free Ably account to get an API key
    // and set it as an environment variable named ABLY_API_KEY.
    const ABLY_API_KEY = import.meta.env.VITE_ABLY_KEY;
    console.log('ABLY_API_KEY:', ABLY_API_KEY);

    if (!ABLY_API_KEY) {
      setAblyError("Ably API Key not found. Please set the ABLY_API_KEY environment variable.");
      return;
    }
    
    const ablyClient = new Realtime({
      key: ABLY_API_KEY,
      clientId: `user-${Math.random().toString(36).substring(2, 9)}`
    });

    ablyClient.connection.on('connected', () => {
      setAbly(ablyClient);
      setAblyError(null);
    });
    
    ablyClient.connection.on('failed', (error: any) => {
        setAblyError(`Ably connection failed: ${error.reason}`);
    });

    return () => {
      ablyClient.close();
    };
  }, []);

  const {
    localStream, remoteStream, messages, isConnected, isMuted, isVideoEnabled, isJoining,
    joinRoom, sendMessage, hangUp, toggleMute, toggleVideo,
  } = useWebRTC(ably);

  const handleHangUp = () => {
    hangUp();
    setCurrentView('chat');
  };
  
  const handleJoinRoom = (roomName: string) => {
      if(ably) {
          joinRoom(roomName);
      }
  }

  const ActiveView = useMemo(() => {
    if (ablyError) {
      return <div className="p-8 text-center text-red-400">{ablyError}</div>;
    }
    
    if (!ably || (!isConnected && !isJoining)) {
      return (
        <div className="p-4 md:p-8 flex items-center justify-center h-full">
            <RoomConnector onJoin={handleJoinRoom} isJoining={isJoining} />
        </div>
      );
    }
    
    if (isJoining) {
       return <div className="p-8 text-center text-dark-text-secondary">Joining room...</div>
    }

    switch (currentView) {
      case 'video':
        return (
          <VideoCallView localStream={localStream} remoteStream={remoteStream} isMuted={isMuted} isVideoEnabled={isVideoEnabled} onToggleMute={toggleMute} onToggleVideo={toggleVideo} onHangUp={handleHangUp} />
        );
      case 'voice':
        return (
          <VoiceCallView isMuted={isMuted} onToggleMute={toggleMute} onHangUp={handleHangUp} />
        );
      case 'chat':
      default:
        return <ChatView messages={messages} sendMessage={sendMessage} />;
    }
  }, [ably, ablyError, isConnected, isJoining, currentView, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo, handleHangUp, messages, sendMessage, joinRoom]);

  const statusText = isJoining ? 'Joining...' : (isConnected ? 'Connected' : 'Disconnected');
  const statusColor = isJoining ? 'bg-yellow-500' : (isConnected ? 'bg-green-500' : 'bg-red-500');

  return (
    <div className="antialiased min-h-screen flex flex-col items-center justify-center p-4 bg-dark-bg">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-dark-surface rounded-lg shadow-2xl border border-dark-border">
        <header className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <Icon path={ICON_PATHS.logo} className="w-8 h-8 text-blue-400"/>
            <h1 className="text-xl font-bold text-dark-text-primary">P2P Connect</h1>
          </div>
          <div className={`absolute top-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white ${statusColor}`}>
              {statusText}
          </div>
          <nav className="flex items-center gap-2">
            <button onClick={() => setCurrentView('chat')} disabled={!isConnected} className={`p-2 rounded-full transition-colors ${currentView === 'chat' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Icon path={ICON_PATHS.chat} />
            </button>
            <button onClick={() => setCurrentView('voice')} disabled={!isConnected} className={`p-2 rounded-full transition-colors ${currentView === 'voice' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Icon path={ICON_PATHS.phone} />
            </button>
            <button onClick={() => setCurrentView('video')} disabled={!isConnected} className={`p-2 rounded-full transition-colors ${currentView === 'video' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Icon path={ICON_PATHS.video} />
            </button>
          </nav>
        </header>
        <main className="flex-1 overflow-hidden">
          {ActiveView}
        </main>
      </div>
    </div>
  );
};

export default App;
