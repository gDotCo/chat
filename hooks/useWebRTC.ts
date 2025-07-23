
import { useState, useRef, useCallback, useEffect } from 'react';
import { Message } from '../types';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [localIceCandidates, setLocalIceCandidates] = useState<string[]>([]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', JSON.stringify(event.candidate));
        setLocalIceCandidates(prev => [...prev, JSON.stringify(event.candidate)]);
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received');
      setRemoteStream(event.streams[0]);
    };

    pc.ondatachannel = (event) => {
      console.log('Data channel received');
      dataChannelRef.current = event.channel;
      setupDataChannel(event.channel);
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
            setIsConnected(true);
            console.log('Peer connection established');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setIsConnected(false);
            console.log('Peer connection lost');
            hangUp();
        }
    };
    
    peerConnectionRef.current = pc;
  }, []);

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => {
      console.log('Data channel is open');
      // No need to set isConnected here, onconnectionstatechange is more reliable.
    };

    dc.onmessage = (event) => {
      const receivedMessage = JSON.parse(event.data);
      setMessages((prev) => [...prev, { ...receivedMessage, sender: 'peer' }]);
    };

    dc.onclose = () => {
      console.log('Data channel is closed');
    };
  };

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      if (!peerConnectionRef.current) {
        setupPeerConnection();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream(stream);
      setIsVideoEnabled(video);
      stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream));
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      throw error;
    }
  }, [setupPeerConnection]);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) setupPeerConnection();

    dataChannelRef.current = peerConnectionRef.current!.createDataChannel('chat');
    setupDataChannel(dataChannelRef.current);
    
    const offer = await peerConnectionRef.current!.createOffer();
    await peerConnectionRef.current!.setLocalDescription(offer);
    
    return JSON.stringify(offer);
  }, [setupPeerConnection]);

  const handleOffer = useCallback(async (offerSdp: string) => {
    if (!peerConnectionRef.current) setupPeerConnection();

    await peerConnectionRef.current!.setRemoteDescription(JSON.parse(offerSdp));
    const answer = await peerConnectionRef.current!.createAnswer();
    await peerConnectionRef.current!.setLocalDescription(answer);

    return JSON.stringify(answer);
  }, [setupPeerConnection]);

  const handleAnswer = useCallback(async (answerSdp: string) => {
    await peerConnectionRef.current?.setRemoteDescription(JSON.parse(answerSdp));
  }, []);

  const addIceCandidate = useCallback(async (candidateSdp: string) => {
    try {
        const candidate = JSON.parse(candidateSdp);
        await peerConnectionRef.current?.addIceCandidate(candidate);
    } catch (error) {
        console.error("Error adding received ICE candidate", error);
    }
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const message: Omit<Message, 'sender'> = {
        id: Date.now().toString(),
        text,
        timestamp: new Date().toLocaleTimeString(),
      };
      dataChannelRef.current.send(JSON.stringify(message));
      setMessages((prev) => [...prev, { ...message, sender: 'me' }]);
    }
  }, []);

  const hangUp = useCallback(() => {
    peerConnectionRef.current?.close();
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setMessages([]);
    setLocalIceCandidates([]);
    console.log('Call ended and resources cleaned up.');
  }, [localStream, remoteStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoEnabled = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      setIsVideoEnabled(videoEnabled);
    }
  }, [localStream, isVideoEnabled]);
  
  useEffect(() => {
      return () => {
          hangUp();
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
  };
};
