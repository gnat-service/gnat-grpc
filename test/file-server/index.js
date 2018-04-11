/**
 * Created by leaf4monkey on 04/09/2018
 */

const express = require('express');
const PATH = require('path');

const app = express();

app.use(
    express.static(
        PATH.join(__dirname, './files'),
        {
            setHeaders: res =>
                res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
        }
    )
);

module.exports = app;
