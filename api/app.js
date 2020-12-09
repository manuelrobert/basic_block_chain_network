'use strict';

const express = require('express');
const app = express();
const http = require('http');

const host = "localhost";
const port = "3000";

http.createServer(app).listen(port, ()=>{
    console.log(`Server running at http://${host}:${port}`);
});

const enrollRouter = require('./routes/enroll');
app.use('/enroll', enrollRouter);