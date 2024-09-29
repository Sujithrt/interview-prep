import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import env from "dotenv";
import fs from "fs";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { v4 as uuidv4 } from "uuid";
import OpenAIApi from "openai";

env.config();
ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
const corsOptions = {
  origin: "*",
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let chat_history = []

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
});

async function transcriptionPipeline(audioData, socket) {
  const uniqueId = uuidv4(); // Generate unique ID for each file/job
  const AUDIO_FILE_NAME = `audio-${uniqueId}.wav`; // Unique WAV file name
  const AUDIO_MIDDLE_NAME = `audio-${uniqueId}.webm`; // Unique WebM file name

  // Write audio data to WebM file
  fs.writeFileSync(AUDIO_MIDDLE_NAME, Buffer.from(audioData));
  const stats = fs.statSync(AUDIO_MIDDLE_NAME);
  if (stats.size === 0) {
    console.error("Empty audio file");
    return;
  }

  // Convert WebM to WAV using ffmpeg and wait for conversion to finish
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(AUDIO_MIDDLE_NAME)
        .inputOptions("-acodec libopus")
        .audioChannels(1)
        .audioFrequency(44100)
        .toFormat("wav")
        .on("end", () => {
          console.log("File converted to wav");
          resolve();
        })
        .on("error", (err) => {
          console.log("Error converting file to wav", err);
          reject(err);
        })
        .save(AUDIO_FILE_NAME);
    });
  } catch (err) {
    console.log(err);
  }

  // Upload WAV file to S3 with a unique filename
  try {
    const fileData = fs.readFileSync(AUDIO_FILE_NAME);
    const putCommand = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: AUDIO_FILE_NAME,  // Use the unique filename
      Body: fileData
    });
    await s3Client.send(putCommand);
    console.log("Successfully uploaded data to S3");
  } catch (err) {
    console.log("Error uploading to S3:", err);
  }

  fs.unlinkSync(AUDIO_FILE_NAME);
  fs.unlinkSync(AUDIO_MIDDLE_NAME);

  // Send audio to AWS Transcribe using a unique job name
  const jobName = `SunHacksTranscriptionJob-${uniqueId}`;  // Unique job name
  const params = {
    TranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    MediaFormat: 'wav',
    Media: {
      MediaFileUri: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${AUDIO_FILE_NAME}`,  // Correct bucket and unique filename
    },
    OutputBucketName: process.env.BUCKET_NAME,
  };
  try {
    await transcribeClient.send(new StartTranscriptionJobCommand(params));
    console.log("Successfully sent transcription job to AWS Transcribe");
  } catch (err) {
    console.log("Error", err);
  }

  // Poll AWS Transcribe for job completion
  const getJobCommand = new GetTranscriptionJobCommand({
    TranscriptionJobName: jobName,
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

  let data;

  // Get transcription from AWS S3 using a unique key
  const getCommand = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: `${jobName}.json`  // Unique transcription result key
  });
  try {
    const response = await s3Client.send(getCommand);
    data = JSON.parse(await response.Body.transformToString())["results"]["transcripts"][0]["transcript"];
    console.log(data);
  } catch (err) {
    console.error(err);
  }

  sendMessage(data).then((response) => {
    console.log(response);

    const synthesizeSpeechCommand = new SynthesizeSpeechCommand({
      Engine: "generative",
      Text: response,
      VoiceId: "Matthew",
      OutputFormat: "mp3",
    });
    const run = async () => {
      const { AudioStream } = await pollyClient.send(synthesizeSpeechCommand);
      // Convert the stream to an ArrayBuffer
      let audioBuffer = [];
      AudioStream.on('data', (chunk) => {
        audioBuffer.push(chunk);
      });

      AudioStream.on('end', () => {
        const audioArrayBuffer = Buffer.concat(audioBuffer);
        // Send the audio data to the frontend via WebSocket
        socket.emit("audio-response", audioArrayBuffer);
      });
    }
    run();
  });
}

// Set up AWS Transcribe
const transcribeClient = new TranscribeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
});
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
});
const pollyClient = new PollyClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
});

async function handleEndInterview(socket) {
  const response = await sendMessage("\
    Now that the interview is over, I want you to generate a report of the interview.\
    Mention how the candidate did in the interview, their strengths, weaknesses, overall score out of 100.\
    Also tell what areas the candidate needs to focus on. The report needs to be generated solely based on \
    the candidate's interview performance. If the interview ends early without much information from \
    the candidate, score them appropriately, don't generalize");
  socket.emit("end-response", response);
  console.log("response", response)
}

async function sendMessage(message = "") {
  try {
    chat_history = chat_history.concat({ role: "user", content: message })
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chat_history,
    });
    chat_history = chat_history.concat({ role: "assistant", content: response.choices[0].message.content })
    return response.choices[0].message.content;
  } catch (err) {
    console.error('Error with OpenAI:', err);
    return 'An error occurred while processing your request.';
  }
}

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("start", () => {
    console.log("Start recording");
  });

  socket.on("end-interview", () => {
    handleEndInterview(socket);
  });

  //resume and job description upload
  socket.on("submit", async ({ resume, jobDescription, selectedInterviewer }) => {
    console.log("resume and job description received");
    chat_history.push(
      {
        role: "system", content: `Your name is PrepBot. You are now an interviewer with more than 10 years of experience. \
          You are taking an interview for the given job description. You have the resume of the candidate. You will be making \
          it a formal interview. You need to introduce yourself, ask for an introduction, and the proceed to asking two questions \
          based on the candidates experience and skills, two technical questions (no coding) based on the job description and two \
          behavioural questions for checking soft skills of the candidate. Here is the job description and the resume of the candidate. \
          You are taking an interactive interview, so wait for the candidate's response. Once the candidate responds, make some comment \
          about the response and proceed to the next question. Do not put any headings, titles, or expectations in round brackets. Do not \
          say you're waiting for my response. It just needs to be a simple conversation.\nJob Description: \n${jobDescription}\nResume: \n\
          ${resume}`
      },
    )

    sendMessage().then((response) => {
      console.log(response);
      const synthesizeSpeechCommand = new SynthesizeSpeechCommand({
        Engine: "generative",
        Text: response,
        VoiceId: selectedInterviewer,
        OutputFormat: "mp3",
      });
      const run = async () => {
        const { AudioStream } = await pollyClient.send(synthesizeSpeechCommand);
        // Convert the stream to an ArrayBuffer
        let audioBuffer = [];
        AudioStream.on('data', (chunk) => {
          audioBuffer.push(chunk);
        });

        AudioStream.on('end', () => {
          const audioArrayBuffer = Buffer.concat(audioBuffer);
          // Send the audio data to the frontend via WebSocket
          socket.emit("audio-response", audioArrayBuffer);
        });
      }
      run();
    });

    // Emit success message back to client
    socket.emit("upload-status", {
      message: "Resume and job description received and processed.",
    });
  });

  socket.on("audio", (audioData) => {
    console.log("Received audio data");
    transcriptionPipeline(audioData, socket);
  });

  socket.on("stop", () => {
    console.log("Stop recording");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(5001, () => {
  console.log("Server is running on port 5001");
});
