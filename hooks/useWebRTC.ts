import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, SignalingMessage } from '../types';

// Assuming Ably is loaded from CDN
declare const Ably: any;
type RealtimePromise = any;
type RealtimeChannelPromise = any;


const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Adding public TURN servers for better NAT/Firewall traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  ],
};

export const useWebRTC = (ably: RealtimePromise | null) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const ablyChannelRef = useRef<RealtimeChannelPromise | null>(null);
  const earlyIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  const setupPeerConnection = useCallback((myClientId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && ablyChannelRef.current) {
        const message: SignalingMessage = { 
            type: 'ice-candidate', 
            candidate: event.candidate.toJSON(),
            from: myClientId 
        };
        ablyChannelRef.current.publish('webrtc-signal', message);
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
        const state = pc.connectionState;
        console.log(`Connection state changed to: ${state}`);
        if (state === 'connected') {
            setIsConnected(true);
        } else if (state === 'failed' || state === 'closed') {
            setIsConnected(false);
            console.log('Peer connection failed or closed.');
            hangUp();
        } else if (state === 'disconnected') {
            // This is a temporary state, the browser may try to reconnect automatically.
            setIsConnected(false); 
            console.log('Peer connection temporarily disconnected.');
        }
    };
    
    peerConnectionRef.current = pc;
  }, []);

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => console.log('Data channel is open');
    dc.onmessage = (event) => {
      const receivedMessage = JSON.parse(event.data);
      setMessages((prev) => [...prev, { ...receivedMessage, sender: 'peer' }]);
    };
    dc.onclose = () => console.log('Data channel is closed');
  };

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    if (!peerConnectionRef.current) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream(stream);
      setIsVideoEnabled(video);
      stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream));
      setMediaError(null);
      return stream;
    } catch (error: any) {
      console.error("Error accessing media devices.", error);
      if (error.name === 'NotFoundError') {
          setMediaError('No camera or microphone found. Voice and video calls are disabled.');
      } else if (error.name === 'NotAllowedError') {
          setMediaError('Permission for camera and microphone was denied. Voice and video calls are disabled.');
      } else {
          setMediaError('Could not access camera or microphone.');
      }
      setLocalStream(null);
      return null;
    }
  }, []);

  const createOffer = useCallback(async (myClientId: string) => {
    if (!peerConnectionRef.current || !ablyChannelRef.current) return;
    dataChannelRef.current = peerConnectionRef.current.createDataChannel('chat');
    setupDataChannel(dataChannelRef.current);
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    const message: SignalingMessage = { type: 'offer', sdp: offer.sdp!, from: myClientId };
    await ablyChannelRef.current.publish('webrtc-signal', message);
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;
    if (peerConnectionRef.current.remoteDescription) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding received ICE candidate", e);
      }
    } else {
      earlyIceCandidatesRef.current.push(candidate);
    }
  }, []);

  const handleReceivedOffer = useCallback(async (offerSdp: string, myClientId: string) => {
    if (!peerConnectionRef.current || !ablyChannelRef.current) return;
    await peerConnectionRef.current.setRemoteDescription({ type: 'offer', sdp: offerSdp });

    for (const candidate of earlyIceCandidatesRef.current) {
        await addIceCandidate(candidate);
    }
    earlyIceCandidatesRef.current = [];

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    const message: SignalingMessage = { type: 'answer', sdp: answer.sdp!, from: myClientId };
    await ablyChannelRef.current.publish('webrtc-signal', message);
  }, [addIceCandidate]);

  const handleReceivedAnswer = useCallback(async (answerSdp: string) => {
    if (!peerConnectionRef.current) return;
    await peerConnectionRef.current.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    for (const candidate of earlyIceCandidatesRef.current) {
        await addIceCandidate(candidate);
    }
    earlyIceCandidatesRef.current = [];
  }, [addIceCandidate]);

  const joinRoom = useCallback(async (roomName: string) => {
    if (!ably) return;
    setIsJoining(true);

    const myClientId = ably.auth.clientId;
    setupPeerConnection(myClientId);

    // Attempt to start local media. This will set mediaError on failure but not crash.
    await startLocalStream(true, true);

    const channel = ably.channels.get(`p2p-chat:${roomName}`);
    ablyChannelRef.current = channel;

    // Subscribe to signaling messages from peers
    await channel.subscribe('webrtc-signal', (message: { data: SignalingMessage }) => {
      const data = message.data;
      if (data.from === myClientId) return;

      switch(data.type) {
        case 'offer':
          handleReceivedOffer(data.sdp, myClientId);
          break;
        case 'answer':
          handleReceivedAnswer(data.sdp);
          break;
        case 'ice-candidate':
          addIceCandidate(data.candidate);
          break;
      }
    });

    // Handles the case where another user joins AFTER me.
    channel.presence.subscribe('enter', async (member: { clientId: string }) => {
        if (member.clientId === myClientId) return; // Ignore my own entry event

        // Tie-breaker logic: peer with smaller ID initiates.
        if (myClientId < member.clientId) {
            // Only create an offer if we're not already connecting
            if (peerConnectionRef.current?.signalingState === 'stable') {
                console.log(`Peer ${member.clientId} entered. Creating offer.`);
                await createOffer(myClientId);
            }
        }
    });

    // Announce my presence. This will trigger the 'enter' event for others.
    await channel.presence.enter();
    
    // Handles the case where I join a room where another user is ALREADY present.
    const members = await channel.presence.get();
    const otherMember = members.find((member: {clientId: string}) => member.clientId !== myClientId);

    if (otherMember) {
        if (myClientId < otherMember.clientId) {
            if (peerConnectionRef.current?.signalingState === 'stable') {
                console.log(`Peer ${otherMember.clientId} was already present. Creating offer.`);
                await createOffer(myClientId);
            }
        }
    }

    setIsJoining(false);
  }, [ably, setupPeerConnection, startLocalStream, createOffer, handleReceivedOffer, handleReceivedAnswer, addIceCandidate]);

  const sendMessage = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const message: Omit<Message, 'sender'> = {
        id: Date.now().toString(),
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      dataChannelRef.current.send(JSON.stringify(message));
      setMessages((prev) => [...prev, { ...message, sender: 'me' }]);
    }
  }, []);

  const hangUp = useCallback(() => {
    ablyChannelRef.current?.presence.leave();
    ablyChannelRef.current?.unsubscribe();
    ablyChannelRef.current = null;
    peerConnectionRef.current?.close();
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsJoining(false);
    setMessages([]);
    setMediaError(null);
    earlyIceCandidatesRef.current = [];
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
    return () => hangUp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream, remoteStream, messages, isConnected, isMuted, isVideoEnabled, isJoining, mediaError,
    joinRoom, sendMessage, hangUp, toggleMute, toggleVideo,
  };
};