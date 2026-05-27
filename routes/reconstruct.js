/**
 * Reconstruction routes (was prestoServer.js)
 * Triggers reconstruction jobs by spawning prestoGo.js
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const config = require('../config');
const reconRegistry = require('../presto/reconRegistry');

// Load reconstruction parameters from the recon registry.
const reconParams = (recon) => reconRegistry.get(recon);

// Start reconstruction process
async function startPresto(launchText, dirname) {
  console.log('Starting presto...');
  console.log(launchText);
  const { stdout, stderr } = exec(launchText);
  stdout.pipe(fs.createWriteStream(path.join(dirname, 'prestoGo_stdout.txt')));
  stderr.pipe(fs.createWriteStream(path.join(dirname, 'prestoGo_stderr.txt')));
  console.log('dir: ' + dirname);
}

// Generate response HTML
const prestoStartHtml = (uniqueID, user, domain, recon, language) => {
  const dirname = path.join(config.paths.userRecons, uniqueID) + '/';
  const prestoGoPath = path.join(config.paths.prestoBase, 'presto', 'prestoGo.js');
  const execComm = `node ${prestoGoPath} ${uniqueID} ${user} ${domain} ${recon} ${language || ''}`;
  startPresto(execComm, dirname);

  const params = reconParams(recon);
  return (
    'Starting your custom PReSto ' + params.lib.title + ', ID: ' + uniqueID + '<br /><br />' +
    "WARNING: Using your browser's 'back' button will overwrite your previous submission<br /><br />" +
    '<a href=' + params.lib.github + ' target="_blank">visit the ' + params.lib.title + ' webpage</a><br /><br />' +
    'The results will be sent to: ' + user + '@' + domain +
    '<br /><br />If results do not arrive within 1-2 hours, check your Spam folder <br /><br />You will automatically be redirected to the Presto home page after 10 seconds' +
    '<br /><br />Let us know how we are doing at the <strong><a href="https://forms.gle/1wPXaCY75WwMyHXJ8" target="_blank" rel="noopener noreferrer">feedback form</a></strong>.' +
    '<script>history.pushState(null, null, window.location.href);history.back();window.onpopstate = () => history.forward();var timeout = 10000; setTimeout(function ()' +
    '{window.location = "https://paleopresto.com/"; }, timeout); </script>'
  );
};

// GET /:recon/:user/:domain/:uniqueID/:language? - language is optional
router.get('/:recon/:user/:domain/:uniqueID/:language?', (req, res) => {
  console.log('uniqueID: ' + req.params.uniqueID);
  console.log('reconID: ' + req.params.uniqueID);
  console.log('language: ' + req.params.language);
  res.send(prestoStartHtml(
    req.params.uniqueID,
    req.params.user,
    req.params.domain,
    req.params.recon,
    req.params.language || ''
  ));
});

module.exports = router;
