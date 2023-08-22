
var fs = require('fs')
var yaml = require('js-yaml')


const lookup = function() {
	        const s = fs.readFileSync('/root/presto/prestoForm/holocene_da/lookup.json','utf8');
	        return JSON.parse(s)
}

//const configs = yaml.load(fs.readFileSync('/root/presto/prestoForm/holocene_da/configs.yml','utf8'));
const configs = yaml.load(fs.readFileSync('/root/presto/jsonEditor/holocene_da_new_configs.yml','utf8'));


const configsOrig = yaml.load(fs.readFileSync('/root/presto/prestoForm/holocene_da/config_default.yml','utf8'));


function writeYaml () {
	                var yamlText = ''
	                var newConfigs = configs
	                var lookups = lookup()
	                for (var key1 in lookups) {

			  var first = lookups[key1].first
			  var last = lookups[key1].last
			  var orig = lookups[key1].orig
			  if (configs.hasOwnProperty(first)){
			    if (configs[first].hasOwnProperty(last)){
				    console.log('long name: ' + configs[first][last].long_name)
			       if (configs[first][last].hasOwnProperty('value')){
				 console.log('orig key: ' + orig)
				 var configs1 = configs[first][last]
				 console.log('orig val: ' + configsOrig[orig])
				 console.log('new value: ' + configs1.value)
				 console.log('......................................................')
				 if (configs1.value == undefined || configs1.value == 'null'){
				   if (orig == 'localization_radius' || orig == 'model_processing'){
			             configsOrig[orig] = 'None'
				   } else if (orig == 'assign_seasonality' || orig == 'change_uncertainty'){
			             configsOrig[orig] = false
				   }
				 } else {
					 /*if (Array.isArray(configsOrig[orig])){
						 console.log(configsOrig[orig])
						 configsOrig[orig] = null
						 console.log(configsOrig[orig])
						 configsOrig[orig] = configs1.value
						 console.log(configsOrig[orig])
					 } else {*/
				                 configsOrig[orig] = configs1.value
					 //}
				 }
				}else{
					console.log('no value')
				}
			     }
			  }
			}
	                console.log(configsOrig)
	            }
writeYaml()

fs.writeFileSync('/root/presto/prestoForm/holocene_da/config_default.yml', yaml.dump(configsOrig), function(err) {
	                            if(err) {
					    return console.log(err)
				    }
	        console.log("/root/presto/prestoForm/holocene_da/config_default.yml has been edited");
});

