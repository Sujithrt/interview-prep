import React from 'react'
import { Box, Button, IconButton } from '@mui/material'
import { Mic, MicOff } from "@mui/icons-material";

export default function Interview({ isRecording, handleStartRecording, handleStopRecording, handleEndInterview }) {
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
            >
                {isRecording ? <MicOff style={{ fontSize: '3rem' }} /> : <Mic style={{ fontSize: '3rem' }} />}
            </IconButton>
            <Button
                variant="contained"
                onClick={handleEndInterview}
                style={{ marginTop: '3rem' }}
            >
                End Interview
            </Button>
        </Box>
    )
}
