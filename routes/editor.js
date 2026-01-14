/**
 * Editor routes (was editorServer.js)
 * Interactive parameter editor for reconstruction configs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const config = require('../config');

const editorDir = path.join(__dirname, '..', 'jsonEditor');

// Serve static files from jsonEditor/public
router.use('/', express.static(path.join(editorDir, 'public')));

// Helper: Find form key in form data
function formKeyIndex(formData, formKey) {
  let ans1 = '';
  for (let keyA in formData) {
    if (keyA == formKey) {
      ans1 = keyA;
    }
  }
  return ans1;
}

// Helper: Parse boolean
function parseBool(val) {
  return val === true || val === 'true';
}

// Edit config file with form data
function editConfigs(configLoc, formEdits, recon, uniqueID) {
  const configDir = path.join(config.paths.userRecons, uniqueID);
  const configFile = fs.readFileSync(configLoc, 'utf8');
  const configFileNew = YAML.parse(configFile);

  for (let key1 in configFileNew) {
    for (let key2 in configFileNew[key1]) {
      const formKey = key1 + '_' + key2;
      console.log(
        'key1: ', key1,
        'key2:', key2,
        'form key:', formKey,
        'old: ', configFileNew[key1][key2]['value'],
        'new: ', formEdits[formKeyIndex(formEdits, formKey)]
      );
      console.log(
        'old object type: ' + typeof configFileNew[key1][key2]['value'] +
        ' new: ' + typeof formEdits[formKeyIndex(formEdits, formKey)]
      );

      let newKey = formEdits[formKeyIndex(formEdits, formKey)];
      if (newKey == undefined) {
        continue;
      }

      if (typeof configFileNew[key1][key2]['value'] === 'number') {
        configFileNew[key1][key2]['value'] = Number(newKey);
      } else if (Array.isArray(configFileNew[key1][key2]['value'])) {
        console.log(
          configFileNew[key1][key2]['long_name'],
          'length: ',
          configFileNew[key1][key2]['value'].length
        );

        if (!Array.isArray(newKey)) {
          newKey = new Array(newKey);
          configFileNew[key1][key2]['value'] = [];
          console.log('made empty array: ' + configFileNew[key1][key2]['value']);
        }

        let dataType = '';
        if (typeof configFileNew[key1][key2]['value'][0] === 'number') {
          dataType = 'num';
        } else if (typeof configFileNew[key1][key2]['value'][0] === 'boolean') {
          dataType = 'bool';
        }

        configFileNew[key1][key2]['value'] = [];
        console.log('made empty array: ' + configFileNew[key1][key2]['value']);

        for (let ii in newKey) {
          console.log('old: ', configFileNew[key1][key2]['value'][ii], ' new: ', newKey[ii]);
          if (dataType === 'num') {
            configFileNew[key1][key2]['value'][ii] = Number(newKey[ii]);
          } else if (dataType === 'bool') {
            configFileNew[key1][key2]['value'][ii] = parseBool(newKey[ii]);
          } else {
            configFileNew[key1][key2]['value'][ii] = newKey[ii];
          }
        }
      } else if (typeof configFileNew[key1][key2]['value'] === 'boolean') {
        configFileNew[key1][key2]['value'] = parseBool(newKey);
      } else {
        configFileNew[key1][key2]['value'] = newKey;
      }
    }
  }

  fs.writeFileSync(path.join(configDir, 'configs.yml'), YAML.stringify(configFileNew), (err) => {
    if (err) {
      return console.log(err);
    }
    console.log('The config file was saved!');
  });

  return path.join(configDir, 'configs.yml');
}

// Write configs and return redirect path
function writeConfigs(recon, user, domain, jsonBody, uniqueID, language) {
  console.log('language: ' + language);
  const reconID = uniqueID + '_' + recon;

  // Use BASE_URL for redirects
  const downloadPath = `${config.baseUrl}/reconstruct/${recon}/${user}/${domain}/${reconID}/${language}`;

  if (recon !== 'download') {
    const configLoc = path.join(config.paths.prestoForm, recon, 'configs.yml');
    editConfigs(configLoc, jsonBody, recon, reconID);
  }

  return downloadPath;
}

// Form location helper
function formLocate(recon1) {
  return path.join(editorDir, 'forms', recon1 + '.html');
}

function formLocate2(recon1) {
  return path.join(editorDir, 'forms-query', recon1 + '.html');
}

// GET / - Main editor form (recon-specific)
router.get('/', (req, res) => {
  res.sendFile(formLocate(req.query.recon));
});

// GET /querypath - Query path form
router.get('/querypath', (req, res) => {
  res.sendFile(formLocate2(req.query.recon));
});

// POST /sendReconRequest - Submit reconstruction request
router.post('/sendReconRequest', (req, res) => {
  console.log(req.query.uniqueID);
  res.redirect(
    writeConfigs(
      req.query.recon,
      req.query.user,
      req.query.domain,
      req.body,
      req.query.uniqueID,
      req.query.language
    )
  );
});

module.exports = router;
