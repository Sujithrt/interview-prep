import React from 'react'
import { Grid, TextField, Select, MenuItem, Button } from '@mui/material'
import { styled } from "@mui/system";
import { CloudUpload } from "@mui/icons-material";
import { INTERVIEWERS } from '../constants';

const StyledSubmitButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(3, 0, 2),
}));

export default function InputForm({ resume, setResume, jobDescription, setJobDescription, selectedInterviewer, handleSubmit, setSelectedInterviewer }) {
  return (
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
            onChange={(event) => setSelectedInterviewer(event.target.value)}
            displayEmpty
            fullWidth
            variant="outlined"
          >
            <MenuItem value={INTERVIEWERS.MATTHEW}>{INTERVIEWERS.MATTHEW}</MenuItem>
            <MenuItem value={INTERVIEWERS.RUTH}>{INTERVIEWERS.RUTH}</MenuItem>
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
  )
}
