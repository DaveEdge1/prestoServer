/**
 * LiPDs routes (was Rserver.js)
 * Saves LiPD data selections to disk for reconstruction jobs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Files written by a downstream step (/datacleaning) that become stale the
// moment the user re-submits the query. Removing them here keeps
// routes/editor.js from silently mixing the new query with the previous
// curation.
const DOWNSTREAM_ARTIFACTS = [
  'cleaned_TSIDs.json',
  'cleaning_report.json',
  'variable_filter.yaml',
  'progress.json',
];

function clearDownstreamArtifacts(dirPath) {
  for (const name of DOWNSTREAM_ARTIFACTS) {
    const p = path.join(dirPath, name);
    try {
      fs.unlinkSync(p);
      console.log(`Cleared stale ${name} for ${path.basename(dirPath)}`);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn(`Failed to clear ${p}:`, err.message);
      }
    }
  }
}

// Create directory with error handling
async function createDirectory(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory "${dirPath}" created or already exists.`);
    return 200;
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.error(`Permission denied to create directory "${dirPath}".`);
      return 400;
    } else if (error.code === 'ENOENT') {
      console.error(`Path "${dirPath}" is invalid.`);
      return 400;
    } else {
      console.error(`An error occurred while creating directory "${dirPath}":`, error);
      return 400;
    }
  }
}

// POST / - Save LiPD selections
router.post('/', (req, res) => {
  const dir1 = path.join(config.paths.userRecons, req.body.uniqueID + '_' + req.body.recon);

  // DEBUG: Log what we received
  console.log('=== POST /lipds received ===');
  console.log('Request body keys:', Object.keys(req.body));
  if ('TSIDs' in req.body) {
    console.log('TSIDs count:', req.body.TSIDs.length);
  }
  if ('datasetIds' in req.body) {
    console.log('datasetIds count:', req.body.datasetIds.length);
    console.log('First 5 datasetIds:', req.body.datasetIds.slice(0, 5));
  } else {
    console.log('WARNING: No datasetIds in request body!');
  }

  if ('TSIDs' in req.body) {
    createDirectory(dir1).then((status) => {
      console.log('Final status:', status);
      res.sendStatus(status);
      if (status == 200) {
        // The user just ran a fresh query — any prior data-cleaning artifacts
        // (cleaned_TSIDs.json, etc.) reference TSIDs from the old query and
        // would be silently re-used by routes/editor.js. Drop them.
        clearDownstreamArtifacts(dir1);
        const path0 = path.join(dir1, 'TSIDs.json');
        const fullJSON = `{"TSIDs":` + JSON.stringify(req.body.TSIDs) + `}`;
        fs.writeFile(path0, fullJSON, (err) => {
          if (err) console.log(err);
          else console.log('File written successfully at: ' + path0);
        });

        // Also save datasetIds if provided
        if ('datasetIds' in req.body) {
          const path1 = path.join(dir1, 'datasetIds.json');
          const datasetJSON = `{"datasetIds":` + JSON.stringify(req.body.datasetIds) + `}`;
          fs.writeFile(path1, datasetJSON, (err) => {
            if (err) console.log(err);
            else console.log('File written successfully at: ' + path1);
          });
        }

        // Save query parameters for lipdGenerator (GitHub Actions filtered pathway)
        if ('queryParams' in req.body && req.body.queryParams) {
          const path2 = path.join(dir1, 'query_params.json');
          fs.writeFile(path2, JSON.stringify(req.body.queryParams, null, 2), (err) => {
            if (err) console.log(err);
            else console.log('File written successfully at: ' + path2);
          });
        }
      } else {
        const path0 = path.join(dir1, 'TSIDs_err.txt');
        fs.writeFile(path0, 'Rserver error! TSIDs not written.', (err) => {
          if (err) console.log(err);
          else console.log('File written successfully at: ' + path0);
        });
      }
    });
  } else if ('compilation' in req.body) {
    const archivedCompJSON =
      '{"compilation": ' +
      JSON.stringify(req.body.compilation) +
      ', "version": ' +
      JSON.stringify(req.body.version) +
      '}';
    createDirectory(dir1).then((status) => {
      console.log('Final status:', status);
      res.sendStatus(status);
      if (status == 200) {
        // Same rationale as above: switching to an archived compilation
        // invalidates any prior data-cleaning state.
        clearDownstreamArtifacts(dir1);
        const path0 = path.join(dir1, 'archivedComp.json');
        fs.writeFile(path0, archivedCompJSON, (err) => {
          if (err) console.log(err);
          else console.log('File written successfully at: ' + path0);
        });
      } else {
        const path0 = path.join(dir1, 'archivedComp_Err.txt');
        fs.writeFile(path0, 'Rserver error! archivedComp not written.', (err) => {
          if (err) console.log(err);
          else console.log('File written successfully at: ' + path0);
        });
      }
    });
  } else {
    console.log("Couldn't find TSIDs or archivedComp in POST from query");
    res.sendStatus(400);
  }
});

module.exports = router;
