import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Megaphone, Volume2, VolumeX } from 'lucide-react';

export const VoiceAnnouncer: React.FC = () => {
  const { lastEvent } = useSocket();
  const [isEnabled, setIsEnabled] = useState(true);
  const [announcementText, setAnnouncementText] = useState<string>('');
  const lastAnnouncedRef = useRef<number>(0);

  useEffect(() => {
    if (!lastEvent || !isEnabled) return;
    
    // Only announce if it's a new event we haven't read yet
    if (lastEvent.timestamp <= lastAnnouncedRef.current) return;
    
    let text = '';
    
    if (lastEvent.name === 'Token Called') {
      const { patient, roomNumber } = lastEvent.payload;
      text = `Token ${patient.tokenNumber}. Please proceed to ${roomNumber}.`;
    } else if (lastEvent.name === 'Token Recalled') {
      const { patient, roomNumber } = lastEvent.payload;
      text = `Recall, Token ${patient.tokenNumber}. Please return to ${roomNumber}.`;
    }

    if (text) {
      lastAnnouncedRef.current = lastEvent.timestamp;
      setAnnouncementText(text);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly slower for crisp clinic audio
      utterance.pitch = 1.0;
      
      // Select a nice English voice if available
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        const primaryVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                             voices.find(v => v.lang.startsWith('en')) || 
                             voices[0];
        if (primaryVoice) {
          utterance.voice = primaryVoice;
        }
      }

      window.speechSynthesis?.cancel(); // Cancel any current utterances in queue
      window.speechSynthesis?.speak(utterance);
    }
  }, [lastEvent, isEnabled]);

  const toggleVoice = () => {
    setIsEnabled(!isEnabled);
    if (isEnabled) {
      window.speechSynthesis?.cancel();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
      <Volume2 className={`w-3.5 h-3.5 text-indigo-600 ${isEnabled ? 'animate-pulse' : ''}`} />
      <span>Audio Assistant:</span>
      <button 
        onClick={toggleVoice}
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition bg-white shadow-xs ${
          isEnabled ? 'text-green-600 border border-green-200 hover:bg-green-50' : 'text-slate-400 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        {isEnabled ? 'ON' : 'OFF'}
      </button>
      {isEnabled && announcementText && (
        <span className="hidden sm:inline-block border-l border-slate-300 pl-2 text-slate-500 italic truncate max-w-xs transition">
          Last: "{announcementText}"
        </span>
      )}
    </div>
  );
};
