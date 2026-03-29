import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function useWebSocket(sessionId) {
  const [connected, setConnected] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setConnected(false);
    });

    socket.on('blink_detected', (data) => {
      console.log('Blink detected:', data);
      setBlinkCount(prev => prev + 1);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => socket.disconnect();
  }, [sessionId]);

  const sendFrame = (frameData) => {
    if (socketRef.current && connected && sessionId) {
      socketRef.current.emit('process_frame', {
        frame: frameData,
        session_id: sessionId
      });
    }
  };

  return { connected, sendFrame, blinkCount };
}