import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const Home = () => {
  const [transcription, setTranscription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [resume, setResume] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunks = useRef([]);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = io("http://localhost:5001");
    socketRef.current.on("connection", () => {
      console.log("Connected to server");
    });

    // Listen for transcription updates
    socketRef.current.on("transcription", (data) => {
      setTranscription((prev) => prev + " " + data);
    });

    // Listen for success or error messages for resume and job description processing
    socketRef.current.on("upload-status", (data) => {
      setStatusMessage(data.message); // Display success message
    });

    socketRef.current.on("upload-error", (error) => {
      setStatusMessage(error); // Display error message
    });

    socketRef.current.on("audio-response", (audioArrayBuffer) => {
      if (audioArrayBuffer) {
        const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
    });

    return () => {
      // Clean up socket connection
      socketRef.current.disconnect();
    };
  }, []);

  const handleStartRecording = () => {
    setIsRecording(true);
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      .then((stream) => {
        console.log("Got audio stream");
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          console.log("Recording stopped");
          const audioBlob = new Blob(audioChunks.current, {
            type: "audio/wav",
          });
          audioChunks.current = [];

          // Convert the audio blob to an ArrayBuffer and send it to the backend
          audioBlob.arrayBuffer().then((audioData) => {
            socketRef.current.emit("audio", audioData);
            console.log("Sent audio data");
          });
        };

        mediaRecorderRef.current.start();
        socketRef.current.emit("start");
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
      });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      socketRef.current.emit("stop");
    }
  };

  const handleResumeUpload = (event) => {
    setResume(event.target.files[0]);
  };

  const handleJobDescriptionChange = (event) => {
    setJobDescription(event.target.value);
  };

  const handleSubmit = () => {
    if (resume && jobDescription) {
      // Convert the resume file to binary format
      const reader = new FileReader();
      reader.readAsArrayBuffer(resume);
      reader.onloadend = () => {
        const resumeData = reader.result;

        // Emit the data via WebSocket
        socketRef.current.emit("submit", {
          resume: resumeData,
          jobDescription: jobDescription,
        });
      };
    } else {
      alert("Please upload a resume and enter a job description.");
    }
  };

  return (
    <div>
      <h2>Resume and Job Description Upload</h2>
      <div>
        <label>Upload Resume:</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleResumeUpload}
        />
      </div>
      <div>
        <label>Job Description:</label>
        <textarea
          value={jobDescription}
          onChange={handleJobDescriptionChange}
          rows="4"
          cols="50"
          placeholder="Enter the job description here..."
        />
      </div>
      <button onClick={handleSubmit}>Submit</button>
      {statusMessage && <p>{statusMessage}</p>} {/* Display status message */}
      <h2>Audio Recording and Text Processing</h2>
      <button onClick={handleStartRecording} disabled={isRecording}>
        Start Recording
      </button>
      <button onClick={handleStopRecording} disabled={!isRecording}>
        Stop Recording
      </button>
      <p>Transcription: {transcription}</p>
      {audioUrl !== null && <audio autoPlay>
        <source src={audioUrl} type="audio/mp3" />
      </audio>}
      <hr />
    </div>
  );
};

export default Home;
