var fs = require('fs')
var yaml = require('js-yaml')
//var uniqueID = '16928062884166311'

const lookup = function() {
	const s = fs.readFileSync('/root/presto/prestoForm/lmr/lmr_variable_lookup.json','utf8');
	return JSON.parse(s)
}

// Load the user-edited PReSto-formatted config file
const configs = yaml.load(fs.readFileSync('/root/presto/userRecons/' + uniqueID  + '/lmr_configs_reformatted.yml','utf8'));

// Load the original LMR config file as template
const configsOrig = yaml.load(fs.readFileSync('/root/presto/prestoForm/lmr/lmr_configs_default.yml','utf8'));

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
					
					if (configs1.value == undefined || configs1.value == 'null' || configs1.value === null){
						// Handle special null cases for LMR config
						if (orig == 'prior_path' || orig == 'obs_path' || orig == 'ptype_clim_dict' || 
						    orig == 'ptype_psm_dict' || orig == 'ptype_season_dict' || orig == 'obs_rename_dict' ||
						    orig == 'filter_proxydb_kwargs' || orig == 'compress_params'){
							configsOrig[orig] = null
						} else if (orig == 'ptype_forward_dict'){
							configsOrig[orig] = {}
						} else if (orig == 'filter_proxydb_args' || orig == 'annualize_proxydb_ptypes' || 
						          orig == 'annualize_proxydb_months'){
							configsOrig[orig] = []
						}
					} else {
						// Special handling for nested objects that need to be reconstructed
						if (orig == 'prior_path') {
							// Reconstruct the nested path object
							configsOrig[orig] = {
								pr: './prev_data/ccsm4_last_millenium/pr_sfc_Amon_CCSM4_past1000_085001-185012.nc',
								tas: './prev_data/ccsm4_last_millenium/tas_sfc_Amon_CCSM4_past1000_085001-185012.nc'
							}
						} else if (orig == 'obs_path') {
							// Reconstruct the nested obs path object
							configsOrig[orig] = {
								pr: './prev_data/GPCC_precip.mon.flux.1x1.v6.nc',
								tas: 'gistemp1200_ERSSTv4'
							}
						} else if (orig == 'obs_rename_dict') {
							// Reconstruct the rename dictionary
							configsOrig[orig] = {
								pr: 'precip',
								tas: 'tempanomaly'
							}
						} else if (orig == 'filter_proxydb_kwargs') {
							// Reconstruct the filter kwargs
							configsOrig[orig] = {
								by: 'ptype',
								keys: ['coral', 'tree', 'ice', 'lake', 'bivalve']
							}
						} else if (orig == 'ptype_clim_dict') {
							// Reconstruct the climate dictionary
							configsOrig[orig] = {
								'tree.TRW': ['tas', 'pr'],
								'tree.MXD': ['tas'],
								'coral.d18O': ['tas'],
								'coral.SrCa': ['tas'],
								'ice.d18O': ['tas'],
								'ice.dD': ['tas'],
								'lake.varve_thickness': ['tas']
							}
						} else if (orig == 'ptype_psm_dict') {
							// Reconstruct the PSM dictionary
							configsOrig[orig] = {
								'tree.TRW': 'Bilinear',
								'tree.MXD': 'Linear',
								'coral.d18O': 'Linear',
								'coral.SrCa': 'Linear',
								'ice.d18O': 'Linear',
								'ice.dD': 'Linear',
								'lake.varve_thickness': 'Linear'
							}
						} else if (orig == 'ptype_season_dict') {
							// Reconstruct the season dictionary
							configsOrig[orig] = {
								'tree.TRW': [
									[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
									[6, 7, 8],
									[3, 4, 5, 6, 7, 8],
									[6, 7, 8, 9, 10, 11],
									[-12, 1, 2],
									[-9, -10, -11, -12, 1, 2],
									[-12, 1, 2, 3, 4, 5]
								],
								'tree.MXD': [
									[6, 7, 8],
									[3, 4, 5, 6, 7, 8],
									[6, 7, 8, 9, 10, 11],
									[-12, 1, 2],
									[-9, -10, -11, -12, 1, 2],
									[-12, 1, 2, 3, 4, 5]
								],
								'coral.d18O': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
								'coral.SrCa': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
								'ice.d18O': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
								'ice.dD': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
								'lake.varve_thickness': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
							}
						} else if (orig == 'compress_params') {
							// Reconstruct the compress params
							configsOrig[orig] = {
								zlib: true
							}
						} else {
							// For simple values, just assign directly
							configsOrig[orig] = configs1.value
						}
					}
				} else {
					console.log('no value')
				}
			}
		}
	}
	console.log(configsOrig)
}

writeYaml()

fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/lmr_configsTranslated.yml', yaml.dump(configsOrig), function(err) {
	if(err) {
		return console.log(err)
	}
	console.log('/root/presto/userRecons/' + uniqueID  + '/lmr_configsTranslated.yml has been edited');
});
