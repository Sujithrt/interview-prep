# Prepify

AI-powered interview preparation tool created for the SunHacks Hackathon at ASU. Our team of four won the **AI Innovation Award** for this project.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [Future Enhancements](#future-enhancements)
- [Contributors](#contributors)

## Overview

The AI Mock Interview Prepper is a tool designed to simulate real-life job interviews. It allows users to upload their resume and job description, select an interviewer voice, and go through an interactive interview where AI asks questions based on the provided inputs. The platform evaluates the interview, generates a performance report, and provides voice-based feedback.

**Winner of the AI Innovation Award at SunHacks Hackathon 2024.**

## Key Features

- **Resume & Job Description Analysis:** Upload your resume and job description to generate tailored interview questions.
- **Voice-based Questions & Responses:** Using AWS Polly and AWS Transcribe, candidates can interact via voice for a real-time interview experience.
- **Customizable Interviewers:** Choose from different virtual interviewers (e.g., "Matthew" or "Ruth").
- **Performance Report:** AI generates an interview report highlighting the candidate's strengths, weaknesses, and overall score based on their responses.
- **Interactive UI:** Smooth user experience with real-time feedback and voice responses via WebSockets.

## Technologies Used

- **Frontend:**
  - React.js
  - Material UI
  - Socket.io for WebSockets
  - ReactMarkdown for report display

- **Backend:**
  - Node.js
  - Express
  - AWS SDK (S3, Polly, Transcribe)
  - ffmpeg for audio processing
  - OpenAI API for chat-based interaction
  - Socket.io for real-time communication

- **Cloud Services:**
  - AWS S3 for storage
  - AWS Polly for speech synthesis
  - AWS Transcribe for voice-to-text conversion

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/Sujithrt/interview-prep.git
    cd interview-prep
    ```

2. Install the required dependencies for both frontend and backend:

    ```bash
    # Backend dependencies
    npm install

    # Frontend dependencies
    cd client
    npm install
    ```

3. Create a `.env` file in the root directory and add the following environment variables:

    ```
    OPENAI_API_KEY=your_openai_api_key
    AWS_ACCESS_KEY_ID=your_aws_access_key
    AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
    BUCKET_NAME=your_s3_bucket_name
    REGION=us-east-1
    ```

4. Start the server:

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5001`.

## Usage

1. Upload your resume and job description.
2. Select an interviewer voice.
3. Start recording your responses via voice.
4. View your performance report after completing the mock interview.
5. Listen to AI-generated feedback using the provided audio.

## Architecture

- **Frontend:** Handles user input, displays interview results, and plays audio responses.
- **Backend:** Manages WebSocket communication, processes audio via ffmpeg, uploads files to AWS S3, and interacts with AWS Polly, Transcribe, and OpenAI.
- **AWS Services:**
  - Polly: Converts AI-generated text into spoken audio.
  - Transcribe: Converts user speech into text.
  - S3: Stores audio files and transcription results.

## Future Enhancements

- Enhanced UI/UX for an even smoother experience.
- Improve real-time response latency.
- Include practice modes with instant feedback.
- Automatic voice input detection for hands-free interaction.
- Incorporate a code editor for coding interviews

## Contributors

- Sujith Tellakula
- Suprad Parashar
- Sriranjini Ramesh Vasista
- Venkat Nikhil Mangipudi
