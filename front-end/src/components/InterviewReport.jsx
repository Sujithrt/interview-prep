import React from 'react'
import { Box, Button } from '@mui/material'
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm'

export default function InterviewReport({ report }) {
  return (
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
  )
}
