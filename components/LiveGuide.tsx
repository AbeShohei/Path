import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';

interface LiveGuideProps {
  initialSystemInstruction?: string;
}

const LiveGuide: React.FC<LiveGuideProps> = ({ initialSystemInstruction }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [volume, setVolume] = useState(0); // For simple visualizer

  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = useCallback(async () => {
    setStatus('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Initialize Audio Contexts
      // Fix: webkitAudioContext does not exist on standard Window type
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });

      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      // Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {

            setStatus('connected');
            setIsActive(true);

            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              // Simple volume meter logic
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputCtx,
                24000,
                1
              );

              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);

              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(src => src.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus('disconnected');
            setIsActive(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setStatus('error');
            setIsActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: initialSystemInstruction || "あなたは京都の観光ガイドです。短く、親しみやすく話してください。",
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [initialSystemInstruction]);

  const stopSession = useCallback(() => {
    // Clean up audio contexts and stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Close session if possible (wrapper doesn't expose explicit close easily without session object, but stream cut kills it effectively)
    // Ideally we call session.close() if we stored the resolved session.
    sessionPromiseRef.current?.then(session => {
      // There is no close method on the session object in the current SDK types shown in prompt, 
      // usually it's handled by cutting the connection or close event.
      // If there was a .close(), we would call it.
    });

    setIsActive(false);
    setStatus('disconnected');
    setVolume(0);
  }, []);

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {isActive ? (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-indigo-100 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex items-center justify-center bg-indigo-600 rounded-full">
                {/* Visualizer Ring */}
                <div
                  className="absolute inset-0 bg-indigo-400 rounded-full opacity-50 animate-pulse"
                  style={{ transform: `scale(${1 + volume * 5})` }}
                ></div>
                <svg className="w-6 h-6 text-white z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">AIガイドと通話中</p>
                <p className="text-xs text-gray-500">何でも聞いてください</p>
              </div>
            </div>
            <button
              onClick={stopSession}
              className="mt-3 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              通話を終了
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startSession}
          disabled={status === 'connecting'}
          className="flex items-center justify-center w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-70 disabled:scale-100"
        >
          {status === 'connecting' ? (
            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default LiveGuide;