import {Preprocessor} from 'cpeediff/src/io/Preprocessor.js';
import {CpeeDiff} from 'cpeediff/src/diff/CpeeDiff.js';
import {DiffConfig} from 'cpeediff/src/config/DiffConfig.js';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// Parser for process models
const parser = new Preprocessor();

const app = express();

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Internal Server Error');
});

app.use(cors())

// Middleware to parse the request body
app.use(bodyParser.text({ type: 'text/xml' }));
const differ = new CpeeDiff();
DiffConfig.PRETTY_XML = true;

app.post('/diff', (req, res) => {
    if (!req.body.includes('>&<')) {
        res.status(400).send('Bad Request: Please provide 2 process trees')
    }
    const parts = req.body.split('>&<');
    const oldTreeRaw = parts[0] + '>';
    const newTreeRaw = '<' + parts[1];

    const oldTree = parser.fromString(oldTreeRaw);
    const newTree = parser.fromString(newTreeRaw);

    const editScript = differ.diff(oldTree, newTree);

    res.status(200).send(editScript.toXmlString());
});

app.listen(27271, () => {
    console.log('Server listening on port 27271');
});
