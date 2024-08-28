var shelljs = require("shelljs");
var fs = require('fs')

var archiveType = [{"lipdName":"Borehole","synonym":"Borehole, borehole"},{"lipdName":"Coral","synonym":"Coral, coral"},{"lipdName":"FluvialSediment","synonym":"Creek, Fluvial, FluvialSediment, River, Stream, "},{"lipdName":"GlacierIce","synonym":"GlacierIce, ice cores"},{"lipdName":"GroundIce","synonym":"GroundIce, bulk ice"},{"lipdName":"LakeSediment","synonym":"Lagoon, Lake, Lake Sediment, LakeSediment, "},{"lipdName":"MarineSediment","synonym":"Marine, MarineSediment, Delta, Marine Sediment, Ocean, "},{"lipdName":"Midden","synonym":"Midden, "},{"lipdName":"MolluskShell","synonym":"MolluskShells, bivalve, MolluskShell"},{"lipdName":"Other","synonym":"Marl, Meadow, Archaeological, Coast, Farmland, Forest, Sediment, Spring, Valley, , Other"},{"lipdName":"Peat","synonym":"Wetland, Bog, Fen, Marsh, Mire, Peat, Swamp, peat"},{"lipdName":"Sclerosponge","synonym":"Sclerosponge, sclerosponge"},{"lipdName":"Shoreline","synonym":"LakeDeposit, LakeDeposits, Shoreline, lake levels"},{"lipdName":"Speleothem","synonym":"Cave, Speleothem, speleothems"},{"lipdName":"TerrestrialSediment","synonym":"Paleosol, Dune, Loess, TerrestrialSediment, Terrestrial Sediment, "},{"lipdName":"Wood","synonym":"Wood, tree ring, tree"}]

queryThenReport = function (){
	//var queryOut = await shelljs.exec('node /root/presto/query/getLipd.js')
	
	console.log(JSON.parse(archiveType));
}

queryThenReport();
