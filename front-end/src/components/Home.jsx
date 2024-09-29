import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const Home = () => {
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = io('http://localhost:5001');
    socketRef.current.on('connection', () => {
      console.log('Connected to server');
    });

    // Listen for transcription updates
    socketRef.current.on('transcription', (data) => {
      setTranscription((prev) => prev + ' ' + data);
    });

    return () => {
      // Clean up socket connection
      socketRef.current.disconnect();
    };
  }, []);

  const handleStartRecording = () => {
    setIsRecording(true);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const anchor = document.createElement('a');
          anchor.href = audioUrl;
          anchor.download = 'audio.wav';
          anchor.click();
          audioChunks.current = [];

          // Convert the audio blob to an ArrayBuffer and send it to the backend
          const reader = new FileReader();  
          reader.readAsArrayBuffer(audioBlob);
          reader.onloadend = () => {
            const audioData = reader.result;
            socketRef.current.emit('audio', audioData);
          };
        };

        mediaRecorderRef.current.start();
        socketRef.current.emit('start');
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
      });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      socketRef.current.emit('stop');
    }
  };

  return (
    <div>
      <button onClick={handleStartRecording} disabled={isRecording}>Start Recording</button>
      <button onClick={handleStopRecording} disabled={!isRecording}>Stop Recording</button>
      <p>Transcription: {transcription}</p>
    </div>
  );
};

export default Home;