/**
 * Forms routes (was formServer.js)
 * Configuration forms and file uploads
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const multer = require('multer');
const config = require('../config');

const formDir = path.join(__dirname, '..', 'prestoForm');

// EJS helpers
const ejs_helpers = require(path.join(formDir, 'helpers.js'));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads');
  },
  filename: function (req, file, cb) {
    cb(null, 'config_default.yml');
  }
});

const maxSize = 1 * 1000 * 10;

const upload = multer({
  storage: storage,
  limits: { fileSize: maxSize },
  fileFilter: function (req, file, cb) {
    const filetypes = /json|yml/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
      return cb(null, true);
    }

    cb('Error: File upload only supports the following filetypes - ' + filetypes);
  }
}).single('conf');

// Serve static files from prestoForm/public
router.use('/', express.static(path.join(formDir, 'public')));

// Track current reconstruction picker (for legacy support)
let reconPicker = '';
let parsedUser = '';
let parsedDomain = '';

// GET /down - Maintenance page
router.get('/down', (req, res) => {
  res.send(
    "Sorry, the Presto Custom Recontruction Engine is currently down for maintenance.<br>We'll be back soon!.<br><br><br>" +
    '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>'
  );
});

// GET / - Main form page
router.get('/', (req, res) => {
  console.log(req.ip);
  res.sendFile(path.join(formDir, 'index.html'));
});

// GET /query - Query parameter info
router.get('/query', (req, res) => {
  res.send(req.query.id + '<br>' + req.query.num);
});

// GET /getUserInfo - Get user info form (needed for OAuth callback redirect)
router.get('/getUserInfo', (req, res) => {
  res.sendFile(path.join(formDir, 'index2.html'));
});

// POST /getUserInfo - Get user info form
router.post('/getUserInfo', (req, res) => {
  res.sendFile(path.join(formDir, 'index2.html'));
});

// GET /configDownload - Download config template
router.get('/configDownload', (req, res) => {
  if (reconPicker === 'holocene_da') {
    const s = fs.readFileSync(
      path.join(formDir, 'holocene_da', 'holoceneDA_configs_standardized.yml'),
      'utf8'
    );
    res.send(YAML.parse(s));
  }
  if (reconPicker === 'temp12k') {
    const s = fs.readFileSync(path.join(formDir, 'temp12k', 'params.json'), 'utf8');
    res.send(JSON.parse(s));
    console.log(JSON.parse(s));
  }
});

// POST /manualORdefault - Choose manual or default config
router.post('/manualORdefault', (req, res) => {
  // Build editor path using BASE_URL
  const editorpath = () => {
    return (
      `${config.baseUrl}/editor/?recon=${req.query.recon}` +
      `&user=${req.query.email.split('@')[0]}` +
      `&domain=${req.query.email.split('@')[1]}` +
      `&uniqueID=${req.query.uniqueID}`
    );
  };

  const whichRecon = (reconPickerVal) => {
    let hrefConfig = '';
    let titleHeading = '';

    if (reconPickerVal === 'temp12k') {
      titleHeading = 'Configure Temperature 12k Paramaters';
      hrefConfig = 'https://github.com/paleopresto/temp12k-regional-composites';
    } else if (reconPickerVal === 'holocene_da') {
      titleHeading = 'Configure Holocene DA Paramaters';
      hrefConfig = 'https://github.com/Holocene-Reconstruction/Holocene-code/blob/main/config_default.yml';
    }

    return { hrefConfig, titleHeading };
  };

  if (req.query.parampath === 'on') {
    res.writeHead(302, {
      Location: editorpath()
    });
    res.end();
  } else {
    res.render('Signup', whichRecon(req.query.recon));
  }
});

// POST /uploadConfigs - Upload configuration file
router.post('/uploadConfigs', (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      res.send(err);
    } else {
      // Build download path using BASE_URL
      const downloadpath = `${config.baseUrl}/reconstruct/${reconPicker}/${parsedUser}/${parsedDomain}/manual`;
      res.writeHead(302, {
        Location: downloadpath
      });
      res.end();
    }
  });
});

module.exports = router;
