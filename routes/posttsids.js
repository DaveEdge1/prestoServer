/**
 * PostTSIDs routes (was postTSidsServer.js)
 * Writes TSids to JSON files in user reconstruction directories
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Validate request
function newStatus(TSids, uniqueID) {
  if (typeof TSids === 'undefined' || typeof uniqueID === 'undefined') {
    console.log('TSids: ' + TSids);
    console.log('uniqueID: ', uniqueID);
    return 400;
  }
  return 200;
}

// Create directory if it doesn't exist
function newDir(dir1) {
  if (!fs.existsSync(dir1)) {
    fs.mkdir(dir1, (err) => {
      if (err) {
        return console.error(err);
      }
    });
  }
}

// Write TSids to file
function writeIt(path1, TSids) {
  if (Array.isArray(TSids)) {
    TSids = '{"TSids": ' + JSON.stringify(TSids) + '}';
  }
  fs.writeFileSync(path1, TSids);
  console.log('File created successfully at: ' + path1);
}

// Write JSON file with TSids
function writeJSON(TSids, uniqueID) {
  const dir1 = path.join(config.paths.userRecons, uniqueID);
  newDir(dir1);
  const path1 = path.join(dir1, 'TSids.json');
  fs.closeSync(fs.openSync(path1, 'w'));
  writeIt(path1, TSids);
}

// POST / - Save TSids
router.post('/', (req, res) => {
  console.log('ping');
  const status = newStatus(req.body.TSIDs, req.body.uniqueID);
  res.sendStatus(status);

  if (status === 200) {
    writeJSON(req.body.TSIDs, req.body.uniqueID);
  }
});

module.exports = router;
