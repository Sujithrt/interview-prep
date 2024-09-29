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
    navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
    }).then((stream) => {
        console.log("Got audio stream");
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
          console.log('Recording stopped');
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          audioChunks.current = [];

          // Convert the audio blob to an ArrayBuffer and send it to the backend
          audioBlob.arrayBuffer().then((audioData) => {
            socketRef.current.emit('audio', audioData);
            console.log('Sent audio data');
          });
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