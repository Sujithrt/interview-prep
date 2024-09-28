const express = require('express');
const cors = require('cors');
// const mongoose = require('mongoose');

const app = express();
require('dotenv').config();

app.use(express.json());
const corsOptions = {
    origin: '*',
    credentials: true,
    optionsSuccessStatus: 200,
}
app.use(cors(corsOptions));

app.get('/', (req, res) => {
    res.send('Welcome to Interview Prep...');
});

const port = process.env.PORT || 5001;

app.listen(port, (req, res) => {
    console.log(`Server listening on port: ${port}`);
})