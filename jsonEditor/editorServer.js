PORT = process.env.PORT || 3004

var fs = require('fs')
var express = require('express'),
    app = express();
var YAML = require('yaml')
var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.json());

app.use(express.static(__dirname + '/public'));
/*
const configs = function (recon) {
  if (recon === 'temp12k') {
    const s = fs.readFileSync('/root/prestoForm/temp12k/params.json','utf8');
    return JSON.parse(s)
  } else if (recon === 'holocene_da') {
      const s = fs.readFileSync('/root/prestoForm/holocene_da/holoceneDA_configs_standardized.yml','utf8');
      return YAML.parse(s)
  }
}
*/
/*
var configLoc = ""
var configLocChange = function (recon) {
  if (recon === 'temp12k'){
    configLoc = '/root/prestoForm/temp12k/params.json'
  } else if (recon === 'holocene_da'){
    configLoc = '/root/prestoForm/holocene_da/holoceneDA_configs_standardized.yml'
  }
}
*/

function formKeyIndex (formData, formKey){
	var ans1 = ''
	for (keyA in formData) {
		if (keyA == formKey){
			ans1 = keyA
		}
	}
	return(ans1)
}

function parseBool(val) { return val === true || val === "true" }

function editConfigs (configLoc, formEdits, recon){
	var configFile = fs.readFileSync(configLoc,'utf8')
	var configFileNew = YAML.parse(configFile)
	for (var key1 in configFileNew){
		for (var key2 in configFileNew[key1]){
			var formKey = key1 + "_" + key2
			console.log("key1: ", key1, "key2:", key2, "form key:", formKey, "old: ", configFileNew[key1][key2]['value'], "new: ", formEdits[formKeyIndex(formEdits, formKey)])
			var newKey = formEdits[formKeyIndex(formEdits, formKey)]
			if (newKey == undefined){
			} else {
				if (typeof(configFileNew[key1][key2]['value']) === "number"){
					configFileNew[key1][key2]['value'] = Number(newKey)
				} else if (Array.isArray(configFileNew[key1][key2]['value'])) {
					console.log(configFileNew[key1][key2]['long_name'], "length: ", configFileNew[key1][key2]['value'].length)
					if (Array.isArray(newKey)){
					}else{
						newKey = new Array(newKey)
					}
					for (ii in configFileNew[key1][key2]['value']){
						console.log("old: ", configFileNew[key1][key2]['value'][ii], " new: ", newKey[ii])
					    if (typeof(configFileNew[key1][key2]['value'][ii]) === "number"){
						    configFileNew[key1][key2]['value'][ii] = Number(newKey[ii])
					    }  else if (typeof(configFileNew[key1][key2]['value'][ii]) === 'boolean'){
						    configFileNew[key1][key2]['value'][ii] = parseBool(newKey[ii])
					    } else {
						    configFileNew[key1][key2]['value'][ii] = newKey[ii]
					    }
					}
				} else if (typeof(configFileNew[key1][key2]['value']) === 'boolean'){
					configFileNew[key1][key2]['value'] = parseBool(newKey)
				}else {
					configFileNew[key1][key2]['value'] = newKey
				}
			}
		}
		//console.log(key1)
		//console.log(configFileNew[1])
		//console.log("orig: ", configFileNew[key1], "new: ", formEdits[key1])
		//configFile[key1] <- formEdits[key1]
	}
	fs.writeFileSync('/root/presto/jsonEditor/' + recon + '_new_configs.yml', YAML.stringify(configFileNew, options={}), function(err) {
                    if(err) {
			    return console.log(err);
		    }
                    console.log("The config file file was saved!");
});
	return('/root/presto/prestoForm/' + recon + 'config.yml')
}

function writeConfigs (recon, user, domain, jsonBody) {
  var configLoc = '/root/presto/prestoForm/' + recon + '/configs.yml'
  var downloadPath = 'http://137.184.4.96:81/' + recon + '/username/' + user + '/domainname/' + domain + '/configloc/manual'
  editConfigs(configLoc, jsonBody, recon)
  return (downloadPath);
}

var userInfo = ''
var getUserInfo = function (reqparamsrecon, reqparamsparsedUser, reqparamsparsedDomain) { 
	var userInfo = { recon: [reqparamsrecon], parsedUser: [reqparamsparsedUser], parsedDomain: [reqparamsparsedDomain] }
	return userInfo;
}

app.get('/:recon/username/:parsedUser/domainname/:parsedDomain/configloc/manual', function (req, res) {
  console.log(req.params.recon)
  userInfo = getUserInfo(req.params.recon, req.params.parsedUser, req.params.parsedDomain)
  res.sendFile('/root/presto/jsonEditor/forms/' + req.params.recon + '.html')
});


app.post('/sendReconRequest', function(req, res) {
        console.log(userInfo)
	console.log(req.body)
	var downloadPath = writeConfigs(userInfo.recon, userInfo.parsedUser, userInfo.parsedDomain, req.body)
	res.redirect(downloadPath)
	//res.download(writeConfigs(userInfo.recon, userInfo.parsedUser, userInfo.parsedDomain, req.body))
});

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
