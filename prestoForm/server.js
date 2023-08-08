express = require("express");
PORT = process.env.PORT || 3002

var app = express()

const yaml = require('js-yaml');
const fs = require('fs');
try {
    const config = yaml.load(fs.readFileSync('/root/presto/config_default.yml', 'utf8'));
    const indentedJson = JSON.stringify(config, null, 4);
    console.log(config.data_dir);
} catch (e) {
    console.log(e);
}

app.get("/", (req, res) => {

  res.send('Starting your reconstruction<br /><br />' + 'Holocene DA Recon - https://github.com/Holocene-Reconstruction/Holocene-code<br /><br />' + 'The results will be sent to: ' + emailRecip)
	//
})



app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
