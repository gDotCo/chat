
export type View = 'chat' | 'voice' | 'video' | 'canvas';

export interface Message {
  type: 'chat';
  id: string;
  text: string;
  username: string;
  timestamp: string;
}

export type Tool = 'pen' | 'eraser' | 'text';

export interface DrawData {
    type: 'draw';
    tool: 'pen' | 'eraser';
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color: string;
    lineWidth: number;
}

export interface TextData {
    type: 'text';
    x: number;
    y: number;
    text: string;
    color: string;
    font: string;
}

export interface ClearData {
    type: 'clear';
}

export type CanvasEventData = DrawData | TextData | ClearData;

export type DataChannelData = Message | CanvasEventData;

export type SignalingMessage =
  | { type: 'offer'; sdp: string; from: string; callType: View }
  | { type: 'answer'; sdp: string; from: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string }
  | { type: 'reject'; from: string }
  | { type: 'cancel'; from: string };
