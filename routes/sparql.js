/**
 * SPARQL routes (was sparqlServer.js)
 * GraphDB SPARQL queries for LiPDverse
 */

const express = require('express');
const router = express.Router();
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Build SPARQL query from TSIDs
function sparqlConstr(TSIDs) {
  const graphDBDir = path.join(__dirname, '..', 'graphDB');
  const query1st = fs.readFileSync(path.join(graphDBDir, 'queryHalf1.sparql'), 'utf8');
  const query2nd = fs.readFileSync(path.join(graphDBDir, 'queryHalf2.sparql'), 'utf8');

  let filterString = '                FILTER (';
  filterString += '?hasVariableID = "' + TSIDs[0] + '" ';

  if (TSIDs.length > 0) {
    for (let i = 0; i < TSIDs.length; i++) {
      filterString += '|| ?hasVariableID = "' + TSIDs[i] + '" ';
    }
  }

  filterString += ')';
  return encodeURI(query1st + filterString + query2nd);
}

// Send query to GraphDB
function sendQuery(TSIDs) {
  const xhr = new XMLHttpRequest();
  xhr.timeout = 99999;

  return new Promise((resolve, reject) => {
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status === 200) {
        let prevResp = xhr.responseText.substring(19);
        prevResp = prevResp.replaceAll('NaN', 'null');
        prevResp = '"' + prevResp;
        prevResp = prevResp.replaceAll(',"[', '":[');
        prevResp = prevResp.replaceAll(']"', '],"');
        prevResp = prevResp.replaceAll(/[\r\n]/g, '');
        prevResp = prevResp.substring(0, prevResp.length - 2);
        prevResp = '{' + prevResp + '}';
        prevResp = prevResp.replaceAll('""', '"');
        prevResp = JSON.parse(prevResp);
        console.log(prevResp);
        resolve(JSON.stringify(prevResp));
      } else {
        const resp1 = "XHR didn't work: " + xhr.status;
        console.log(resp1);
        resolve(resp1);
      }
    };

    xhr.open('POST', config.graphDbUrl + '/repositories/LiPDVerse3', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    const jsbody = 'query=' + sparqlConstr(TSIDs);
    xhr.send(jsbody);
  });
}

// POST / - Execute SPARQL query
router.post('/', (req, res) => {
  sendQuery(req.body.TSIDs).then((reso) => res.json(reso));
});

module.exports = router;
