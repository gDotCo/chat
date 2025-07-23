
import React, { useState, useMemo } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { View } from './types';
import { ConnectionManager } from './components/ConnectionManager';
import { ChatView } from './components/ChatView';
import { VideoCallView } from './components/VideoCallView';
import { VoiceCallView } from './components/VoiceCallView';
import Icon from './components/Icon';
import { ICON_PATHS } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('chat');
  const {
    localStream,
    remoteStream,
    messages,
    isConnected,
    isMuted,
    isVideoEnabled,
    localIceCandidates,
    startLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    sendMessage,
    hangUp,
    toggleMute,
    toggleVideo,
  } = useWebRTC();

  const handleHangUp = () => {
    hangUp();
    setCurrentView('chat'); // Go back to chat view after hanging up
  };

  const ActiveView = useMemo(() => {
    if (!isConnected) {
      return (
        <div className="p-4 md:p-8">
            <ConnectionManager
              createOffer={createOffer}
              handleOffer={handleOffer}
              handleAnswer={handleAnswer}
              addIceCandidate={addIceCandidate}
              startLocalStream={startLocalStream}
              localIceCandidates={localIceCandidates}
            />
        </div>
      );
    }

    switch (currentView) {
      case 'video':
        return (
          <VideoCallView
            localStream={localStream}
            remoteStream={remoteStream}
            isMuted={isMuted}
            isVideoEnabled={isVideoEnabled}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onHangUp={handleHangUp}
          />
        );
      case 'voice':
        return (
          <VoiceCallView
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onHangUp={handleHangUp}
          />
        );
      case 'chat':
      default:
        return <ChatView messages={messages} sendMessage={sendMessage} />;
    }
  }, [isConnected, currentView, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo, handleHangUp, messages, sendMessage, createOffer, handleOffer, handleAnswer, addIceCandidate, startLocalStream, localIceCandidates]);

  return (
    <div className="antialiased min-h-screen flex flex-col items-center justify-center p-4 bg-dark-bg">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-dark-surface rounded-lg shadow-2xl border border-dark-border">
        <header className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <Icon path={ICON_PATHS.logo} className="w-8 h-8 text-blue-400"/>
            <h1 className="text-xl font-bold text-dark-text-primary">P2P Connect</h1>
          </div>
          <div className={`absolute top-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
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
        <main className="flex-1">
          {ActiveView}
        </main>
      </div>
    </div>
  );
};

export default App;
