
import React, { useState, useMemo, useEffect } from 'react';
import Ably from 'ably';
import { useWebRTC } from './hooks/useWebRTC';
import { View } from './types';
import { RoomConnector } from './components/ConnectionManager';
import { ChatView } from './components/ChatView';
import { VideoCallView } from './components/VideoCallView';
import { VoiceCallView } from './components/VoiceCallView';
import { CanvasView } from './components/CanvasView';
import Icon from './components/Icon';
import { ICON_PATHS } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [ably, setAbly] = useState<Ably.Realtime | null>(null);
  const [ablyError, setAblyError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');

  useEffect(() => {
    // Vite injects environment variables here.
    // This will be replaced by your GitHub Secret during the build process.
    const ABLY_API_KEY = import.meta.env.VITE_ABLY_KEY;

    if (!ABLY_API_KEY) {
      setAblyError("Ably API Key not found. Ensure VITE_ABLY_API_KEY is set in your environment or GitHub Secrets.");
      return;
    }
    
    const ablyClient = new Ably.Realtime({
      key: ABLY_API_KEY,
      clientId: `user-${Math.random().toString(36).substring(2, 9)}`
    });

    ablyClient.connection.on('connected', () => {
      setAbly(ablyClient);
      setAblyError(null);
    });
    
    ablyClient.connection.on('failed', (stateChange: Ably.ConnectionStateChange) => {
        setAblyError(`Ably connection failed: ${stateChange.reason?.message ?? 'Unknown error'}`);
    });

    return () => {
      ablyClient.close();
    };
  }, []);

  const {
    localStream, remoteStream, messages, hasJoinedRoom, isConnected, isMuted, isVideoEnabled, isJoining, mediaError, lastCanvasEvent,
    joinRoom, sendMessage, hangUp, toggleMute, toggleVideo, sendDrawData, sendClearCanvas, sendTextData
  } = useWebRTC(ably, username, roomName);

  const handleHangUp = () => {
    hangUp();
    setRoomName('');
    setCurrentView('chat');
  };
  
  const handleJoinRoom = (newRoomName: string, newUsername: string) => {
      if(ably) {
          setUsername(newUsername);
          setRoomName(newRoomName);
          joinRoom();
      }
  }

  const ActiveView = useMemo(() => {
    if (ablyError) {
      return <div className="p-8 text-center text-red-400">{ablyError}</div>;
    }
    
    if (!ably || !hasJoinedRoom) {
      return (
        <div className="p-4 md:p-8 flex items-center justify-center h-full">
            <RoomConnector onJoin={handleJoinRoom} isJoining={isJoining} />
        </div>
      );
    }

    switch (currentView) {
      case 'video':
        return (
          <VideoCallView localStream={localStream} remoteStream={remoteStream} isMuted={isMuted} isVideoEnabled={isVideoEnabled} onToggleMute={toggleMute} onToggleVideo={toggleVideo} onHangUp={handleHangUp} />
        );
      case 'voice':
        return (
          <VoiceCallView remoteStream={remoteStream} isMuted={isMuted} onToggleMute={toggleMute} onHangUp={handleHangUp} />
        );
      case 'canvas':
        return (
            <CanvasView
                sendDrawData={sendDrawData}
                sendTextData={sendTextData}
                sendClearCanvas={sendClearCanvas}
                lastCanvasEvent={lastCanvasEvent}
            />
        );
      case 'chat':
      default:
        return <ChatView messages={messages} sendMessage={sendMessage} username={username} />;
    }
  }, [ably, ablyError, hasJoinedRoom, isJoining, currentView, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo, handleHangUp, messages, sendMessage, handleJoinRoom, mediaError, lastCanvasEvent, sendDrawData, sendClearCanvas, sendTextData]);

  const { statusText, statusColor } = useMemo(() => {
    if (isJoining) {
        return { statusText: 'Connecting...', statusColor: 'bg-yellow-500' };
    }
    if (isConnected) {
        return { statusText: 'Connected', statusColor: 'bg-green-500' };
    }
    if (hasJoinedRoom) {
        return { statusText: 'Waiting for Peer', statusColor: 'bg-blue-500' };
    }
    return { statusText: 'Disconnected', statusColor: 'bg-red-500' };
  }, [isJoining, isConnected, hasJoinedRoom]);
  

  return (
    <div className="antialiased min-h-screen flex flex-col items-center justify-center p-4 bg-dark-bg">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-dark-surface rounded-lg shadow-2xl border border-dark-border">
        <header className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
          </div>
          { hasJoinedRoom && (
            <div className={`absolute top-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white ${statusColor}`}>
                {statusText}
            </div>
          )}
          <nav className="flex items-center gap-2">
            <button onClick={() => setCurrentView('chat')} disabled={!hasJoinedRoom} className={`p-2 rounded-full transition-colors ${currentView === 'chat' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Icon path={ICON_PATHS.chat} />
            </button>
            <button 
              onClick={() => setCurrentView('voice')} 
              disabled={!isConnected || !!mediaError} 
              title={mediaError ?? (isConnected ? 'Switch to voice call' : 'Connect to enable')}
              className={`p-2 rounded-full transition-colors ${currentView === 'voice' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Icon path={ICON_PATHS.phone} />
            </button>
            <button 
              onClick={() => setCurrentView('video')} 
              disabled={!isConnected || !!mediaError}
              title={mediaError ?? (isConnected ? 'Switch to video call' : 'Connect to enable')}
              className={`p-2 rounded-full transition-colors ${currentView === 'video' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Icon path={ICON_PATHS.video} />
            </button>
             <button onClick={() => setCurrentView('canvas')} disabled={!isConnected} className={`p-2 rounded-full transition-colors ${currentView === 'canvas' ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Icon path={ICON_PATHS.pen} />
            </button>
          </nav>
        </header>
        <main className="flex-1 overflow-hidden relative">
           {mediaError && hasJoinedRoom && (
            <div className="absolute top-0 left-0 right-0 p-2 bg-yellow-600 text-white text-center text-sm z-10 animate-pulse">
                <p>{mediaError}</p>
            </div>
           )}
          {ActiveView}
        </main>
      </div>
    </div>
  );
};

export default App;
