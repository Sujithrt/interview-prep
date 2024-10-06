// Import required modules
import express from "express";
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

// Global Variables
const AWS_REGION = "us-east-1";
const SERVER_PORT = 5001;

// Load environment variables
env.config();

// Set up ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Create an express app
const app = express();

// Create a WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Setup Clients
const openAIClient = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
});
const awsConfig = {
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
};
const transcribeClient = new TranscribeClient(awsConfig);
const s3Client = new S3Client(awsConfig);
const pollyClient = new PollyClient(awsConfig);

/**
 * Converts the audio buffer received from client to a WAV file.
 * 
 * @param {*} uuid - Unique identifier for the Interaction.
 * @param {*} audioData - Audio buffer received from the client.
 * @returns - Object containing the status of the operation, name of the audio file created, and a message.
 */
async function createAudioFileFromBuffer(uuid, audioData) {
  // File Names
  const AUDIO_WAV_FILE_NAME = `audio-${uuid}.wav`;
  const AUDIO_WEBM_FILE_NAME = `audio-${uuid}.webm`;

  // Create WEBM File
  fs.writeFileSync(AUDIO_WEBM_FILE_NAME, Buffer.from(audioData));
  const stats = fs.statSync(AUDIO_WEBM_FILE_NAME);
  if (stats.size === 0) {
    return {
      isSuccessful: false,
      audioFile: null,
      message: "Resulting Audio file is empty. Did not create file.",
    }
  }

  // Convert WEBM to WAV.
  try {
    return await new Promise((resolve, reject) => {
      ffmpeg(AUDIO_WEBM_FILE_NAME)
        .inputOptions("-acodec libopus")
        .audioChannels(1)
        .audioFrequency(44100)
        .toFormat("wav")
        .on("end", () => {
          resolve({
            isSuccessful: true,
            audioFile: AUDIO_WAV_FILE_NAME,
            message: "Successfully converted file to wav",
          })
        })
        .on("error", (err) => {
          reject({
            isSuccessful: false,
            audioFile: null,
            message: "Error converting file to wav. Here is the error:\n" + err,
          })
        })
        .save(AUDIO_WAV_FILE_NAME);
    });
  } catch (err) {
    return {
      isSuccessful: false,
      audioFile: null,
      message: "Error converting file to wav. Here is the error:\n" + err,
    }
  }
}

/**
 * Uploads the Audio File to S3.
 * 
 * @param {*} audioFileName - Name of the audio file to upload.
 * @param {*} bucketName - Name of the S3 bucket.
 * @returns - Object containing the status of the operation and a message.
 */
async function uploadAudioFileToS3(audioFileName, bucketName) {
  try {
    // Upload the file to S3
    const _ = await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: audioFileName,
      Body: fs.readFileSync(audioFileName),
    }));
    return {
      isSuccessful: true,
      message: "Successfully uploaded file to S3.",
    }
  } catch (err) {
    return {
      isSuccessful: false,
      message: "Error uploading file to S3. Here is the error:\n" + err,
    }
  } finally {
    // Delete the local files
    fs.unlinkSync(audioFileName);
    fs.unlinkSync(audioFileName.replace(".wav", ".webm"));
  }
}

/**
 * Creates a transcription job on AWS Transcribe for the audio file stored in S3.
 * 
 * @param {*} uuid - Unique identifier for the Interaction.
 * @param {*} audioFileName - Name of the audio file to transcribe.
 * @param {*} audioLanguageCode - Language code of the audio file. Default is "en-US".
 * @param {*} bucketName - Name of the S3 bucket.
 * @returns - Object containing the status of the operation, a message, and the name of the transcription job.
 */
async function createTranscriptionJob(uuid, audioFileName, audioLanguageCode = "en-US", bucketName) {
  const jobName = `PrepifyTranscriptionJob-${uuid}`;
  try {
    // Create a transcription job
    const _ = await transcribeClient.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: audioLanguageCode,
      MediaFormat: 'wav',
      Media: {
        MediaFileUri: `https://${bucketName}.s3.amazonaws.com/${audioFileName}`,
      },
      OutputBucketName: bucketName,
    }));
    return {
      isSuccessful: true,
      message: "Successfully sent transcription job to AWS Transcribe.",
      jobName: jobName,
    }
  } catch (err) {
    return {
      isSuccessful: false,
      message: "Error sending transcription job to AWS Transcribe. Here is the error:\n" + err,
      jobName: null,
    }
  }
}

/**
 * Polls AWS Transcribe for job completion and waits until the job is completed.
 * 
 * @param {*} jobName - Name of the transcription job.
 * @returns - Object containing the status of the operation and a message.
 */
async function awaitJobCompletion(jobName) {
  while (true) {
    try {
      const transcriptionJobData = await transcribeClient.send(new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
      }));
      if (transcriptionJobData["TranscriptionJob"]["TranscriptionJobStatus"] === "COMPLETED") {
        return {
          isSuccessful: true,
          message: "Transcription job completed",
        }
      }
    } catch (err) {
      return {
        isSuccessful: false,
        message: "Error polling AWS Transcribe for job completion. Here is the error:\n" + err,
      }
    }
  }
}

/**
 * Obtains the transcription from the completed transcription job on AWS Transcribe.
 * 
 * @param {*} jobName - Name of the transcription job.
 * @param {*} bucketName - Name of the S3 bucket.
 * @returns - Object containing the status of the operation, a message, and the transcription.
 */
async function getTranscriptionFromS3(jobName, bucketName) {
  try {
    const s3GetObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: `${jobName}.json`,
    }));
    const data = JSON.parse(await s3GetObjectResponse.Body.transformToString())["results"]["transcripts"][0]["transcript"];
    return {
      isSuccessful: true,
      message: "Successfully transcribed audio file",
      transcription: data,
    }
  } catch (err) {
    return {
      isSuccessful: false,
      message: "Error getting transcription from AWS S3. Here is the error:\n" + err,
      transcription: null,
    }
  }
}

/**
 * Transcribes an audio file stored in S3 using AWS Transcribe and returns the transcription.
 * 
 * @param {*} uuid - Unique identifier for the Interaction.
 * @param {*} audioFileName - Name of the audio file to transcribe.
 * @param {*} audioLanguageCode - Language code of the audio file. Default is "en-US".
 * @param {*} bucketName - Name of the S3 bucket.
 * @returns - Object containing the status of the operation, a message, and the transcription.
 */
async function transcribeAudioFile(uuid, audioFileName, audioLanguageCode = "en-US", bucketName) {
  // Create a transcription job
  const transcriptionJobResponse = await createTranscriptionJob(uuid, audioFileName, audioLanguageCode, bucketName);
  if (!transcriptionJobResponse.isSuccessful) {
    return {
      isSuccessful: false,
      message: transcriptionJobResponse.message,
      transcription: null,
    }
  }
  console.debug(transcriptionJobResponse.message);

  // Poll AWS Transcribe for job completion
  console.debug("Polling AWS Transcribe for job completion...");
  const jobCompletionResponse = await awaitJobCompletion(transcriptionJobResponse.jobName);
  if (!jobCompletionResponse.isSuccessful) {
    return {
      isSuccessful: false,
      message: jobCompletionResponse.message,
      transcription: null,
    }
  }
  console.debug(jobCompletionResponse.message);

  // Return Transcription
  const transcriptionResponse = await getTranscriptionFromS3(transcriptionJobResponse.jobName, bucketName);
  return {
    isSuccessful: transcriptionResponse.isSuccessful,
    message: transcriptionResponse.message,
    transcription: transcriptionResponse.transcription,
  }
}

/**
 * Sends a message to OpenAI and returns the response.
 * 
 * @param {*} message - Message to send to OpenAI.
 * @param {*} socket - Socket object to store the chat history.
 * @returns - Object containing the status of the operation, a message, and the response from OpenAI.
 */
async function chatWithOpenAI(message = "", socket) {
  try {
    // Append the message to the chat history
    socket.data.chat_history = socket.data.chat_history.concat({ role: "user", content: message })

    // Send the message to OpenAI
    const openAIResponse = await openAIClient.chat.completions.create({
      model: "gpt-4o",
      messages: socket.data.chat_history,
    });
    const data = openAIResponse.choices[0].message.content;

    // Append the response to the chat history
    socket.data.chat_history = socket.data.chat_history.concat({ role: "assistant", content: data });

    // Return the response
    return {
      isSuccessful: true,
      message: "Received response from OpenAI.",
      data: data,
    }
  } catch (err) {
    return {
      isSuccessful: false,
      message: "Error with processing your request with OpenAI. Here is the error:\n" + err,
      data: null,
    }
  }
}

/**
 * Converts the AudioStream object from AWS Polly to an AudioBuffer.
 * 
 * @param {*} audioStream - AudioStream object from AWS Polly.
 * @returns - Object containing the status of the operation, a message, and the audio buffer.
 */
async function convertAudioStreamToBuffer(audioStream) {
  return new Promise((resolve, _) => {
    try {
      let audioBuffer = [];
      audioStream.on("data", (chunk) => {
        audioBuffer.push(chunk);
      });
      audioStream.on("end", () => {
        resolve({
          isSuccessful: true,
          message: "Successfully converted audio stream to buffer.",
          audioBuffer: Buffer.concat(audioBuffer),
        });
      });
    } catch (err) {
      resolve({
        isSuccessful: false,
        message: "Error converting audio stream to buffer. Here is the error:\n" + err,
        audioBuffer: null,
      });
    }
  });
}

/**
 * Converts given text to speech using AWS Polly and returns an audio buffer.
 * 
 * @param {*} text - Text to convert to speech.
 * @param {*} voiceId - Voice ID to use for the speech.
 * @returns - Object containing the status of the operation, a message, and the audio buffer.
 */
async function getAudioBufferFromPolly(text, voiceId) {
  try {
    // Get the audio stream from Polly
    const { AudioStream } = await pollyClient.send(new SynthesizeSpeechCommand({
      Engine: "generative",
      Text: text,
      VoiceId: voiceId,
      OutputFormat: "mp3",
    }));
    
    // Convert the audio stream to buffer
    const audioBufferResponse = await convertAudioStreamToBuffer(AudioStream);
    return {
      isSuccessful: audioBufferResponse.isSuccessful,
      message: audioBufferResponse.message,
      data: audioBufferResponse.audioBuffer,
    }
  } catch (err) {
    return {
      isSuccessful: false,
      message: "Error getting speech from Polly. Here is the error:\n" + err,
      data: null,
    }
  }
}

/**
 * The main loop to process user input.
 * Steps include:
 * 1. Create an audio file from the audio data.
 * 2. Upload the audio file to S3.
 * 3. Transcribe the audio file using AWS Transcribe.
 * 4. Send the transcription to OpenAI.
 * 5. Convert the response from OpenAI to audio using AWS Polly.
 * 6. Send the audio response back to the client.
 * 
 * @param {*} audioData - Audio buffer received from the client.
 * @param {*} selectedInterviewer - Name of the interviewer selected by the user.
 * @param {*} socket - Socket object to store the chat history.
 * @returns - None.
 */
async function interactionPipelineLoop(audioData, selectedInterviewer, socket) {
  // Create a unique identifier for AudioFiles and Jobs.
  const uuid = uuidv4();

  // Create an audio file from the audio data
  const audioFileCreationResponse = await createAudioFileFromBuffer(uuid, audioData);
  if (!audioFileCreationResponse.isSuccessful) {
    console.error(audioFileCreationResponse.message);
    return;
  }
  console.debug(audioFileCreationResponse.message);

  // Upload WAV file to S3
  const uploadAudioFileToS3Response = await uploadAudioFileToS3(audioFileCreationResponse.audioFile, process.env.BUCKET_NAME);
  if (!uploadAudioFileToS3Response.isSuccessful) {
    console.error(uploadAudioFileToS3Response.message);
    return;
  }
  console.debug(uploadAudioFileToS3Response.message);

  // Transcribe the audio file
  const transcribeAudioFileResponse = await transcribeAudioFile(uuid, audioFileCreationResponse.audioFile, "en-US", process.env.BUCKET_NAME);
  if (!transcribeAudioFileResponse.isSuccessful) {
    console.error(transcribeAudioFileResponse.message);
    return;
  }
  console.debug(transcribeAudioFileResponse.message);
  console.debug(`Transcription: ${transcribeAudioFileResponse.transcription}`);

  // Send the transcription to OpenAI
  const chatReponse = await chatWithOpenAI(transcribeAudioFileResponse.transcription, socket);
  if (!chatReponse.isSuccessful) {
    console.error(chatReponse.message);
    return;
  }
  console.debug(chatReponse.message);
  console.info("ChatGPT Response:", chatReponse.data);
  
  // Get audio buffer from Polly
  const pollyResponse = await getAudioBufferFromPolly(chatReponse.data, selectedInterviewer);
  if (!pollyResponse.isSuccessful) {
    console.error(pollyResponse.message);
    return;
  }
  console.debug(pollyResponse.message);

  // Send the audio response to the client
  socket.emit("audio-response", pollyResponse.data);
}

/**
 * Sets up the initial chat history using the job description and resume.
 * Starts the interview with the selected interviewer.
 * 
 * @param {*} resume  - Resume of the candidate.
 * @param {*} jobDescription - Job description for the interview.
 * @param {*} selectedInterviewer - Name of the interviewer selected by the user.
 * @param {*} socket - Socket object to store the chat history.
 * @returns - None.
 */
async function handleStartInterview(resume, jobDescription, selectedInterviewer, socket) {
  // Set up the initial prompt.
  socket.data.chat_history = [{
    role: "system",
    content: `Your name is ${selectedInterviewer}. You are now an interviewer with more than 10 years of experience. \
      You are taking an interview for the given job description. You have the resume of the candidate. You will be making \
      it a formal interview. You need to introduce yourself, ask for an introduction, and the proceed to asking two questions \
      based on the candidates experience and skills, two technical questions (no coding) based on the job description and two \
      behavioural questions for checking soft skills of the candidate. Here is the job description and the resume of the candidate. \
      You are taking an interactive interview, so wait for the candidate's response. Once the candidate responds, make some comment \
      about the response and proceed to the next question. Do not put any headings, titles, or expectations in round brackets. Do not \
      say you're waiting for my response. It just needs to be a simple conversation.\nJob Description: \n${jobDescription}\nResume: \n\
      ${resume}`
  }];

  // Start the interview
  const chatReponse = await chatWithOpenAI("", socket);
  if (!chatReponse.isSuccessful) {
    console.error(chatReponse.message);
    return;
  }
  console.debug(chatReponse.message);
  console.info("ChatGPT Response:", chatReponse.data);

  // Get audio buffer from Polly
  const pollyResponse = await getAudioBufferFromPolly(chatReponse.data, selectedInterviewer);
  if (!pollyResponse.isSuccessful) {
    console.error(pollyResponse.message);
    return;
  }
  console.debug(pollyResponse.message);

  // Send the audio response to the client
  socket.emit("audio-response", pollyResponse.data);

  // Emit success message back to client
  socket.emit("upload-status", {
    message: "Interview started successfully.",
  });
}

/**
 * End the interview and generate a report based on the candidate's performance.
 * 
 * @param {*} socket - Socket object to store the chat history.
 * @returns - None.
 */
async function handleEndInterview(socket) {
  // End Interview Prompt.
  const chatReponse = await chatWithOpenAI("Now that the interview is over, I want you to generate a report of the interview.\
    Mention how the candidate did in the interview, their strengths, weaknesses, overall score out of 100.\
    Also tell what areas the candidate needs to focus on. The report needs to be generated solely based on \
    the candidate's interview performance. If the interview ends early without much information from \
    the candidate, score them appropriately, don't generalize. If you don't have any information, don't \
    put it in the report. Do not use any placeholders, if there is no information for the report, just mention that.\
    Also, do not score or provide strengths and weaknesses if there is no information or interview concluded prematurely.", socket);

  if (!chatReponse.isSuccessful) {
    console.error(chatReponse.message);
    return;
  }
  console.debug(chatReponse.message);
  console.info("Interview Report:", chatReponse.data);

  // Return the report to the client
  socket.emit("end-response", chatReponse.data);
}

/** 
 * Handle Socket Connections and Events.
 */
io.on("connection", (socket) => {
  console.log("Established connection with a client.");

  /**
   * Handle Recording Start Event.
   */
  socket.on("start", () => {
    console.log("Recording started.");
  });

  /**
   * Handle End Interview Event.
   */
  socket.on("end-interview", () => {
    handleEndInterview(socket);
  });

  /** 
   * Handle Start Interview Event.
   */
  socket.on("submit", async ({ resume, jobDescription, selectedInterviewer }) => {
    console.debug("Received Resume and Job Description.");
    handleStartInterview(resume, jobDescription, selectedInterviewer, socket);
  });

  /** 
   * Handle Audio Buffer from Server.
   */
  socket.on("audio", ({ audioData, selectedInterviewer }) => {
    console.debug("Received Audio Data");
    interactionPipelineLoop(audioData, selectedInterviewer, socket);
  });

  /** 
   * Handle Stop Recording Event.
   */
  socket.on("stop", () => {
    console.log("Recording Stopped.");
  });

  /** 
   * Handle Client Disconnection.
   */
  socket.on("disconnect", () => {
    console.log("Client Disconnected.");
  });
});

// Run Server
server.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});