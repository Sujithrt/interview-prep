import React from 'react'
import { Box, Button, IconButton } from '@mui/material'
import { Mic, MicOff } from "@mui/icons-material";

export default function Interview({ isRecording, handleStartRecording, handleStopRecording, handleEndInterview, interviewerSpeaking }) {
    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
        >
            <IconButton
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                color="primary"
                style={{ fontSize: '3rem' }}
                disabled={interviewerSpeaking}
            >
                {isRecording ? <MicOff style={{ fontSize: '3rem' }} /> : <Mic style={{ fontSize: '3rem' }} />}
            </IconButton>
            <Button
                variant="outlined"
                onClick={handleEndInterview}
                style={{ marginTop: '3rem' }}
                disabled={interviewerSpeaking}
            >
                End Interview
            </Button>
        </Box>
    )
}
