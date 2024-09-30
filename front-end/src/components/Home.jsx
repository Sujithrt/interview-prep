import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  IconButton,
  Snackbar,
  Select,
  MenuItem,
} from "@mui/material";
import { Mic, MicOff, CloudUpload } from "@mui/icons-material";
import { styled } from "@mui/system";
import io from "socket.io-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import { CircularProgress } from "@mui/material";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  margin: theme.spacing(4, 0),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
}));

const StyledSubmitButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(3, 0, 2),
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

  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunks = useRef([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEndInterview = () => {
    socketRef.current.emit("end-interview");
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
        console.log("This is URL", url);
        setAudioUrl(url);
        setLoading(false);
      }
    });

    socketRef.current.on("end-response", (report) => {
      setIsEndOfInterview(true);
      setReport(report);
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
              socketRef.current.emit("audio", {audioData, selectedInterviewer}); 
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

  const handleInterviewerChange = (event) => {
    setSelectedInterviewer(event.target.value);
  };

  return (
    <>
      <Container component="main" maxWidth="md">
        <StyledPaper elevation={6}>
          <Typography component="h1" variant="h4" gutterBottom>
            Prepify
          </Typography>
          <Box width="100%" mt={3}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <CircularProgress />
              </Box>
            ) : (
              !isSetup ? (
                <>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        multiline
                        rows={6}
                        variant="outlined"
                        label="Resume"
                        value={resume}
                        onChange={(e) => setResume(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        multiline
                        rows={6}
                        variant="outlined"
                        label="Job Description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Select
                        value={selectedInterviewer}
                        onChange={handleInterviewerChange}
                        displayEmpty
                        fullWidth
                        variant="outlined"
                      >
                        <MenuItem value="Matthew">Matthew</MenuItem>
                        <MenuItem value="Ruth">Ruth</MenuItem>
                      </Select>
                    </Grid>
                  </Grid>
                  <StyledSubmitButton
                    onClick={handleSubmit}
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<CloudUpload />}
                  >
                    Submit Application
                  </StyledSubmitButton>
                </>
              ) : (
                !isEndOfInterview && (
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexDirection="column"
                  >
                    <IconButton
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      color="primary"
                      style={{ fontSize: '3rem' }} // Increase the size of the icon
                    >
                      {isRecording ? <MicOff style={{ fontSize: '3rem' }} /> : <Mic style={{ fontSize: '3rem' }} />}
                    </IconButton>
                    <Button
                      variant="contained"
                      onClick={handleEndInterview}
                      style={{ marginTop: '3rem' }} // Align the button to the right
                    >
                      End Interview
                    </Button>
                  </Box>
                )
              )
            )}
            {isEndOfInterview && (
              <Box>
                <ReactMarkdown children={report} remarkPlugins={[remarkGfm]} />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => window.location.reload()}
                  style={{ marginTop: '1rem' }} // Add some margin to the top
                >
                  Back to Home
                </Button>
              </Box>
            )}
          </Box>
        </StyledPaper>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={statusMessage}
        />
        {audioUrl !== null && (
          <audio key={audioUrl} autoPlay>
            <source src={audioUrl} type="audio/mp3" />
          </audio>
        )}
      </Container>
    </>
  );
}
