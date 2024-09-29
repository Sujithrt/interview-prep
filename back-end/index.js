import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import env from 'dotenv';
import fs from 'fs';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

env.config();
ffmpeg.setFfmpegPath(ffmpegPath.path);

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

async function transcriptionPipeline(audioData) {
    // Convert audio data to wav
    const AUDIO_FILE_NAME = 'audio.wav';
    const AUDIO_MIDDLE_NAME = 'audio.webm';
    fs.writeFileSync(AUDIO_MIDDLE_NAME, Buffer.from(audioData));
    const stats = fs.statSync(AUDIO_MIDDLE_NAME);
    if (stats.size === 0) {
      console.err("Empty audio file");
      return;
    }
    try {
      ffmpeg(AUDIO_MIDDLE_NAME)
        .inputOptions("-acodec libopus")
        .audioChannels(1)
        .audioFrequency(44100)
        .toFormat("wav")
        .on("end", () => {
          console.log("File converted to wav");
        })
        .on("error", (err) => {
          console.log("Error converting file to wav", err);
        })
        .save(AUDIO_FILE_NAME);
    } catch (err) {
      console.log(err);
    }

    // Upload Audio to S3.
    const fileData = fs.readFileSync(AUDIO_FILE_NAME);
    const putCommand = new PutObjectCommand({
      Bucket: "sunhacks",
      Key: AUDIO_FILE_NAME,
      Body: fileData
    });
    try {
      await s3Client.send(putCommand);
      console.log("Successfully uploaded data to S3");
    } catch (err) {
      console.log(err);
    }

    // Send audio to AWS Transcribe
    const jobName = 'SunHacksTranscriptionJob' + new Date().getTime();
    const params = {
      TranscriptionJobName: jobName,
      LanguageCode: 'en-US',
      MediaFormat: 'wav',
      Media: {
        MediaFileUri: 'https://sunhacks.s3.amazonaws.com/' + AUDIO_FILE_NAME,
      },
      OutputBucketName: "sunhacks",
    };
    try {
      await transcribeClient.send(new StartTranscriptionJobCommand(params));
      console.log("Successfully sent transcription job to AWS Transcribe");
    } catch (err) {
      console.log("Error", err);
    }

    // Poll AWS Transcribe for job completion
    const getJobCommand = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    });
    while (true) {
      try {
        const data = await transcribeClient.send(getJobCommand);
        if (data["TranscriptionJob"]["TranscriptionJobStatus"] === "COMPLETED") {
          console.log("Transcription job completed");
          break;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Get transcription from AWS S3.
    const getCommand = new GetObjectCommand({
      Bucket: "sunhacks",
      Key: jobName + ".json"
    });
    try {
      const response = await s3Client.send(getCommand);
      const data = JSON.parse(await response.Body.transformToString());
      console.log(data["results"]["transcripts"][0]["transcript"]);
    } catch (err) {
      console.error(err);
    }
}

// Set up AWS Transcribe
const transcribeClient = new TranscribeClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY,
    },
});
const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY,
    },
});

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('start', () => {
    console.log('Start recording');
    // Initialize AWS Transcribe streaming here if needed
  });

  socket.on('audio', (audioData) => {
    console.log('Received audio data');
    transcriptionPipeline(audioData);
  });

  socket.on('stop', () => {
    console.log('Stop recording');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(5001, () => {
  console.log('Server is running on port 5001');
});