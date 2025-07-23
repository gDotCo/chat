
import React, { useState, useCallback } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface ConnectionManagerProps {
  createOffer: () => Promise<string>;
  handleOffer: (offer: string) => Promise<string>;
  handleAnswer: (answer: string) => Promise<void>;
  addIceCandidate: (candidate: string) => Promise<void>;
  startLocalStream: (video: boolean, audio: boolean) => Promise<MediaStream | null>;
  localIceCandidates: string[];
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  createOffer,
  handleOffer,
  handleAnswer,
  addIceCandidate,
  startLocalStream,
  localIceCandidates
}) => {
  const [sdp, setSdp] = useState('');
  const [generatedSdp, setGeneratedSdp] = useState('');
  const [peerIceCandidates, setPeerIceCandidates] = useState('');
  const [sdpCopied, setSdpCopied] = useState(false);
  const [iceCopied, setIceCopied] = useState(false);
  
  const handleCreateOffer = useCallback(async () => {
    try {
      await startLocalStream(true, true);
      const offer = await createOffer();
      setGeneratedSdp(offer);
    } catch (error) {
        setGeneratedSdp('Failed to create offer. Ensure camera/mic permissions are granted.');
    }
  }, [createOffer, startLocalStream]);

  const handleReceiveOffer = useCallback(async () => {
    if (!sdp) {
        setGeneratedSdp('Paste the offer from your peer first.');
        return;
    };
    try {
      await startLocalStream(true, true);
      const answer = await handleOffer(sdp);
      setGeneratedSdp(answer);
    } catch (error) {
      setGeneratedSdp('Failed to handle offer. Make sure the offer is valid.');
    }
  }, [handleOffer, sdp, startLocalStream]);

  const handleReceiveAnswer = useCallback(async () => {
    if (!sdp) return;
    try {
      await handleAnswer(sdp);
      setGeneratedSdp('Connection should be established now! Exchange ICE candidates if needed.');
    } catch (error) {
      setGeneratedSdp('Failed to handle answer. Make sure the answer is valid.');
    }
  }, [handleAnswer, sdp]);

  const handleAddIceCandidates = useCallback(async () => {
    if (!peerIceCandidates) return;
    try {
        const candidates = peerIceCandidates.split('\n').filter(c => c.trim() !== '');
        for (const candidate of candidates) {
            await addIceCandidate(candidate);
        }
        setPeerIceCandidates(''); // Clear after adding
    } catch (error) {
        console.error("Failed to add ICE candidates", error);
    }
  }, [addIceCandidate, peerIceCandidates]);
  
  const handleCopySdp = useCallback(() => {
    if (generatedSdp) {
        navigator.clipboard.writeText(generatedSdp).then(() => {
            setSdpCopied(true);
            setTimeout(() => setSdpCopied(false), 2000);
        }).catch(err => {
            console.error('Could not copy SDP text: ', err);
        });
    }
  }, [generatedSdp]);
  
  const handleCopyIce = useCallback(() => {
    const iceString = localIceCandidates.join('\n');
    if (iceString) {
        navigator.clipboard.writeText(iceString).then(() => {
            setIceCopied(true);
            setTimeout(() => setIceCopied(false), 2000);
        }).catch(err => {
            console.error('Could not copy ICE candidates: ', err);
        });
    }
  }, [localIceCandidates]);


  return (
    <div className="p-6 bg-dark-surface rounded-lg shadow-lg space-y-6">
      <h2 className="text-xl font-bold text-dark-text-primary">Connection Setup</h2>
      <p className="text-sm text-dark-text-secondary">
        To connect, one person creates an offer and sends it. The other person pastes the offer, creates an answer, and sends it back. Then, both exchange ICE candidates.
      </p>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 1: Create/Receive Offer/Answer</h3>
        <div className="flex gap-4">
          <button onClick={handleCreateOffer} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">1A: Create Offer</button>
          <button onClick={handleReceiveOffer} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">1B: Paste Offer & Create Answer</button>
        </div>
        
        <label htmlFor="sdp-input" className="block text-sm font-medium text-dark-text-secondary pt-2">Paste Peer's Offer/Answer Below:</label>
        <textarea
          id="sdp-input"
          value={sdp}
          onChange={(e) => setSdp(e.target.value)}
          placeholder="Paste SDP (offer/answer) from your peer here"
          className="w-full h-24 p-2 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        <button onClick={handleReceiveAnswer} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Step 2: Accept Answer</button>
      </div>

      <div className="space-y-2">
         <label htmlFor="generated-sdp" className="block text-sm font-medium text-dark-text-secondary">Your Generated Offer/Answer (Copy & Send):</label>
        <div className="relative">
          <textarea
            id="generated-sdp"
            readOnly
            value={generatedSdp}
            placeholder="Your Offer/Answer will appear here..."
            className="w-full h-24 p-2 pr-12 bg-gray-900 border border-dark-border rounded-md"
          />
          {generatedSdp && (
            <button
                onClick={handleCopySdp}
                className="absolute top-2 right-2 p-2 text-dark-text-secondary hover:text-dark-text-primary rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
                aria-label={sdpCopied ? "Copied" : "Copy to clipboard"}
            >
                <Icon path={sdpCopied ? ICON_PATHS.check : ICON_PATHS.copy} className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
            <label htmlFor="generated-ice" className="block text-sm font-medium text-dark-text-secondary">Your ICE Candidates (Copy & Send):</label>
            <div className="relative">
            <textarea
                id="generated-ice"
                readOnly
                value={localIceCandidates.join('\n')}
                placeholder="ICE candidates appear here..."
                className="w-full h-24 p-2 pr-12 bg-gray-900 border border-dark-border rounded-md"
            />
            {localIceCandidates.length > 0 && (
                <button
                    onClick={handleCopyIce}
                    className="absolute top-2 right-2 p-2 text-dark-text-secondary hover:text-dark-text-primary rounded-full hover:bg-gray-700 transition-colors focus:outline-none"
                    aria-label={iceCopied ? "Copied" : "Copy ICE candidates"}
                >
                    <Icon path={iceCopied ? ICON_PATHS.check : ICON_PATHS.copy} className="w-5 h-5" />
                </button>
            )}
            </div>
        </div>
        <div className="space-y-2">
            <label htmlFor="ice-candidate-input" className="block text-sm font-medium text-dark-text-secondary">Peer's ICE Candidates (Paste Here):</label>
            <textarea
            id="ice-candidate-input"
            value={peerIceCandidates}
            onChange={(e) => setPeerIceCandidates(e.target.value)}
            placeholder="Paste ICE candidates from peer here, one per line."
            className="w-full h-24 p-2 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-blue-500"
            />
        </div>
      </div>
       <button onClick={handleAddIceCandidates} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Step 3: Add Peer's ICE Candidates</button>

    </div>
  );
};
