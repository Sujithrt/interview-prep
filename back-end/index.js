// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const { Server } = require("socket.io");
// const AWS = require('aws-sdk');
// const { env } = require('process');

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import env from 'dotenv';
import { AudioContext } from 'web-audio-api';
import audioBufferToWav from 'audiobuffer-to-wav';
import fs from 'fs';
import createBuffer from 'audio-buffer-from';
import { TranscribeClient, StartTranscriptionJobCommand, TranscriptionJobStatus } from '@aws-sdk/client-transcribe';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

env.config();

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
    AUDIO_FILE_NAME = 'audio.wav';
    //Save Audio to a file.
    const audioBuffer = createBuffer(audioData, {
      sampleRate: 44100,
      channels: 1,
    });
    const wav = audioBufferToWav(audioBuffer);
    fs.writeFileSync(AUDIO_FILE_NAME, Buffer.from(wav));
    //TODO: Fix this shit.

    // //Upload Audio to S3.
    // const fileData = fs.readFileSync('audio.wav');
    // const command = new PutObjectCommand({
    //   Bucket: "sunhacks",
    //   Key: "audio.wav",
    //   Body: fileData
    // });
    // s3Client.send(command);

    // Send audio to AWS Transcribe
    const params = {
      TranscriptionJobName: 'SunHacksTranscriptionJob_' + new Date().getTime(),
      LanguageCode: 'en-US',
      MediaFormat: 'wav',
      Media: {
        MediaFileUri: 'https://sunhacks.s3.amazonaws.com/harvard.wav',
      },
      OutputBucketName: "sunhacks",
    };
    const run = async () => {
      try {
        const data = await transcribeClient.send(
          new StartTranscriptionJobCommand(params)
        );
        console.log("Success - put", data);
        return data; // For unit tests.
      } catch (err) {
        console.log("Error", err);
      }
    };
    run();
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