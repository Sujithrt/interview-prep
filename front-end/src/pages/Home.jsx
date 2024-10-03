import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Typography,
  Box,
  Paper,
  Snackbar,
} from "@mui/material";
import { styled } from "@mui/system";
import io from "socket.io-client";
import { CircularProgress } from "@mui/material";
import InputForm from "../components/InputForm";
import Interview from "../components/Interview";
import InterviewReport from "../components/InterviewReport";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  margin: theme.spacing(4, 0),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
}));

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isEndOfInterview, setIsEndOfInterview] = useState(false);
  const [report, setReport] = useState("");
  const [selectedInterviewer, setSelectedInterviewer] = useState("Matthew");
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunks = useRef([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEndInterview = () => {
    socketRef.current.emit("end-interview");
    setLoadingReport(true);
  }

  useEffect(() => {
    socketRef.current = io("http://localhost:5001");
    socketRef.current.on("connection", () =>
      console.log("Connected to server")
    );
    socketRef.current.on("upload-status", (data) => {
      setStatusMessage(data.message);
      setSnackbarOpen(true);
    });
    socketRef.current.on("upload-error", (error) => {
      setStatusMessage(error);
      setSnackbarOpen(true);
    });
    socketRef.current.on("audio-response", (audioArrayBuffer) => {
      if (audioArrayBuffer) {
        const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setLoading(false);
        setInterviewerSpeaking(true);
        const audio = new Audio(url);
        audio.onended = () => {
          setInterviewerSpeaking(false);
        };
        audio.play();
      }
    });

    socketRef.current.on("end-response", (report) => {
      setIsEndOfInterview(true);
      setReport(report);
      setLoadingReport(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [audioUrl]);

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
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });
        mediaRecorderRef.current.ondataavailable = (event) =>
          audioChunks.current.push(event.data);
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, {
            type: "audio/wav",
          });
          audioChunks.current = [];
          audioBlob.arrayBuffer().then((audioData) => {
            if (socketRef.current) {
              socketRef.current.emit("audio", { audioData, selectedInterviewer });
            }
          });
        };
        mediaRecorderRef.current.start();
        if (socketRef.current) {
          socketRef.current.emit("start");
        }
      })
      .catch((error) => console.error("Error accessing microphone:", error));
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setLoading(true);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (socketRef.current) {
        socketRef.current.emit("stop");
      }
    }
  };

  const handleSubmit = () => {
    if (resume && jobDescription) {
      if (socketRef.current) {
        setIsSetup(true);
        socketRef.current.emit("submit", { resume, jobDescription, selectedInterviewer });
      }
    } else {
      setStatusMessage("Please enter both resume and job description.");
      setSnackbarOpen(true);
    }
  };

  return (
    <Container component="main" maxWidth="md">
      <StyledPaper elevation={6}>
        <Typography component="h1" variant="h4" gutterBottom>
          Prepify
        </Typography>
        <Box width="100%" mt={3}>
          {loading || loadingReport ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress />
            </Box>
          ) : (
            !isSetup ? <InputForm
              resume={resume}
              jobDescription={jobDescription}
              setResume={setResume}
              setJobDescription={setJobDescription}
              setSelectedInterviewer={setSelectedInterviewer}
              selectedInterviewer={selectedInterviewer}
              handleSubmit={handleSubmit}
            /> : (
              !isEndOfInterview && <Interview
                isRecording={isRecording}
                handleStartRecording={handleStartRecording}
                handleStopRecording={handleStopRecording}
                handleEndInterview={handleEndInterview}
                interviewerSpeaking={interviewerSpeaking}
              />
            )
          )}
          {isEndOfInterview && <InterviewReport report={report} />}
        </Box>
      </StyledPaper>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={statusMessage}
      />
    </Container>
  );
}
