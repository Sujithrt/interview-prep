const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const AWS = require('aws-sdk');

const app = express();
const corsOptions = {
    origin: '*',
    credentials: true,
    optionsSuccessStatus: 200,
}
app.use(cors(corsOptions));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});


// Set up AWS Transcribe
const transcribeService = new AWS.TranscribeService({
    region: 'us-east-1',
    credentials: {
        accessKeyId: "",
        secretAccessKey: ""
    }
});

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('start', () => {
    console.log('Start recording');
    // Initialize AWS Transcribe streaming here if needed
  });

  socket.on('audio', (audioData) => {
    // Process the audio data and send it to AWS Transcribe
    // const params = {
    //   LanguageCode: 'en-US',
    //   Media: {
    //     MediaFileUri: audioData,
    //   },
    //   // Add other AWS Transcribe parameters as needed
    // };

    // transcribeService.startTranscriptionJob(params, (err, data) => {
    //   if (err) {
    //     console.error(err);
    //   } else {
    //     // Send transcription back to the client
    //     socket.emit('transcription', data.Transcript);
    //   }
    // });
    console.log("audio", audioData)
  });

  socket.on('stop', () => {
    console.log('Stop recording');
    // Handle stopping of AWS Transcribe if needed
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(5001, () => {
  console.log('Server is running on port 5001');
});