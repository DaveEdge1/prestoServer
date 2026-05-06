// Top 15 most common interpretation variables (shared across query pages)
var top15InterpVars = [
   "temperature",
   "precipitation",
   "effectivePrecipitation",
   "temperature|precipitationIsotope",
   "growingDegreeDays",
   "temperature|temperature|seawaterIsotope",
   "precipitation|precipitationIsotope",
   "precipitationIsotope",
   "seaIce",
   "salinity|seawaterIsotope",
   "streamflow",
   "upwelling",
   "effectivePrecipitation|effectivePrecipitation",
   "temperature|seawaterIsotope",
   "salinity"
];

// Autocomplete source for the Interpretation Variable filter.
// LIKE '%value%' in buildQstring means combo entries (e.g. "temperature|precipitationIsotope")
// also match when the user picks "temperature" or "precipitationIsotope".
var interpVarList = [
   "temperature",
   "precipitation",
   "effectivePrecipitation",
   "precipitationIsotope",
   "seawaterIsotope",
   "growingDegreeDays",
   "seaIce",
   "salinity",
   "streamflow",
   "upwelling"
].map(function (v) { return { value: v, label: v }; });

var continentlist = [{"value":"Africa","label":"Africa"},{"value":"Antarctica","label":"Antarctica"},{"value":"Asia","label":"Asia"},{"value":"Australia","label":"Australia"},{"value":"Europe","label":"Europe"},{"value":"North America","label":"North America"},{"value":"South America","label":"South America"}]

var countrylist = [{"value":"Afghanistan","label":"Afghanistan"},{"value":"Aland","label":"Aland"},{"value":"Albania","label":"Albania"},{"value":"Algeria","label":"Algeria"},{"value":"Antarctica","label":"Antarctica"},{"value":"Argentina","label":"Argentina"},{"value":"Armenia","label":"Armenia"},{"value":"Australia","label":"Australia"},{"value":"Austria","label":"Austria"},{"value":"Belarus","label":"Belarus"},{"value":"Belgium","label":"Belgium"},{"value":"Belize","label":"Belize"},{"value":"Bermuda","label":"Bermuda"},{"value":"Bhutan","label":"Bhutan"},{"value":"Bolivia","label":"Bolivia"},{"value":"Botswana","label":"Botswana"},{"value":"Brazil","label":"Brazil"},{"value":"Bulgaria","label":"Bulgaria"},{"value":"Burundi","label":"Burundi"},{"value":"Canada","label":"Canada"},{"value":"Cayman Islands","label":"Cayman Islands"},{"value":"Chad","label":"Chad"},{"value":"Chile","label":"Chile"},{"value":"China","label":"China"},{"value":"Colombia","label":"Colombia"},{"value":"Cook Islands","label":"Cook Islands"},{"value":"Costa Rica","label":"Costa Rica"},{"value":"Cuba","label":"Cuba"},{"value":"Czech Republic","label":"Czech Republic"},{"value":"Democratic Republic of the Congo","label":"Democratic Republic of the Congo"},{"value":"Denmark","label":"Denmark"},{"value":"Djibouti","label":"Djibouti"},{"value":"Dominican Republic","label":"Dominican Republic"},{"value":"Ecuador","label":"Ecuador"},{"value":"Egypt","label":"Egypt"},{"value":"Estonia","label":"Estonia"},{"value":"Ethiopia","label":"Ethiopia"},{"value":"Faroe Islands","label":"Faroe Islands"},{"value":"Finland","label":"Finland"},{"value":"France","label":"France"},{"value":"French Polynesia","label":"French Polynesia"},{"value":"Georgia","label":"Georgia"},{"value":"Germany","label":"Germany"},{"value":"Ghana","label":"Ghana"},{"value":"Greece","label":"Greece"},{"value":"Greenland","label":"Greenland"},{"value":"Guam","label":"Guam"},{"value":"Guatemala","label":"Guatemala"},{"value":"Haiti","label":"Haiti"},{"value":"Hungary","label":"Hungary"},{"value":"Iceland","label":"Iceland"},{"value":"India","label":"India"},{"value":"Indonesia","label":"Indonesia"},{"value":"Iran","label":"Iran"},{"value":"Ireland","label":"Ireland"},{"value":"Israel","label":"Israel"},{"value":"Italy","label":"Italy"},{"value":"Jamaica","label":"Jamaica"},{"value":"Japan","label":"Japan"},{"value":"Jordan","label":"Jordan"},{"value":"Kazakhstan","label":"Kazakhstan"},{"value":"Kenya","label":"Kenya"},{"value":"Kyrgyzstan","label":"Kyrgyzstan"},{"value":"Laos","label":"Laos"},{"value":"Lebanon","label":"Lebanon"},{"value":"Libya","label":"Libya"},{"value":"Lithuania","label":"Lithuania"},{"value":"Luxembourg","label":"Luxembourg"},{"value":"Macedonia","label":"Macedonia"},{"value":"Madagascar","label":"Madagascar"},{"value":"Malawi","label":"Malawi"},{"value":"Malaysia","label":"Malaysia"},{"value":"Mali","label":"Mali"},{"value":"Malta","label":"Malta"},{"value":"Mauritania","label":"Mauritania"},{"value":"Mexico","label":"Mexico"},{"value":"Mongolia","label":"Mongolia"},{"value":"Morocco","label":"Morocco"},{"value":"Namibia","label":"Namibia"},{"value":"Nauru","label":"Nauru"},{"value":"Nepal","label":"Nepal"},{"value":"Netherlands","label":"Netherlands"},{"value":"New Zealand","label":"New Zealand"},{"value":"Nicaragua","label":"Nicaragua"},{"value":"Niger","label":"Niger"},{"value":"Nigeria","label":"Nigeria"},{"value":"Norway","label":"Norway"},{"value":"Oman","label":"Oman"},{"value":"Pakistan","label":"Pakistan"},{"value":"Papua New Guinea","label":"Papua New Guinea"},{"value":"Peru","label":"Peru"},{"value":"Poland","label":"Poland"},{"value":"Portugal","label":"Portugal"},{"value":"Romania","label":"Romania"},{"value":"Russia","label":"Russia"},{"value":"Saudi Arabia","label":"Saudi Arabia"},{"value":"Senegal","label":"Senegal"},{"value":"Seychelles","label":"Seychelles"},{"value":"Slovakia","label":"Slovakia"},{"value":"Slovenia","label":"Slovenia"},{"value":"South Africa","label":"South Africa"},{"value":"South Korea","label":"South Korea"},{"value":"South Sudan","label":"South Sudan"},{"value":"Spain","label":"Spain"},{"value":"Sudan","label":"Sudan"},{"value":"Sweden","label":"Sweden"},{"value":"Switzerland","label":"Switzerland"},{"value":"Syria","label":"Syria"},{"value":"Taiwan","label":"Taiwan"},{"value":"Tajikistan","label":"Tajikistan"},{"value":"Thailand","label":"Thailand"},{"value":"The Bahamas","label":"The Bahamas"},{"value":"Togo","label":"Togo"},{"value":"Tunisia","label":"Tunisia"},{"value":"Turkey","label":"Turkey"},{"value":"Uganda","label":"Uganda"},{"value":"Ukraine","label":"Ukraine"},{"value":"United Kingdom","label":"United Kingdom"},{"value":"United Republic of Tanzania","label":"United Republic of Tanzania"},{"value":"United States of America","label":"United States of America"},{"value":"Uzbekistan","label":"Uzbekistan"},{"value":"Vanuatu","label":"Vanuatu"},{"value":"Venezuela","label":"Venezuela"},{"value":"Vietnam","label":"Vietnam"},{"value":"West Bank","label":"West Bank"},{"value":"Western Sahara","label":"Western Sahara"},{"value":"Yemen","label":"Yemen"},{"value":"Zambia","label":"Zambia"}]

var seasonalitylist = [{"value":"Annual","label":"Annual"},{"value":"Growing Season","label":"Growing Season"},{"value":"Warmest Month","label":"Warmest Month"},{"value":"Coldest Month","label":"Coldest Month"},{"value":"Wet Season","label":"Wet Season"},{"value":"Winter","label":"Winter"},{"value":"Spring","label":"Spring"},{"value":"Summer","label":"Summer"},{"value":"Fall","label":"Fall"},{"value":"subannual","label":"subannual"}]

var archivelist = [{"value":"Borehole","label":"Borehole, borehole"},{"value":"Coral","label":"Coral, coral"},{"value":"Documents","label":"Documents"},{"value":"FluvialSediment","label":"Creek, Fluvial, FluvialSediment, River, Stream, "},{"value":"GlacierIce","label":"GlacierIce, ice cores"},{"value":"GroundIce","label":"GroundIce, bulk ice"},{"value":"LakeSediment","label":"Lagoon, Lake, Lake Sediment, LakeSediment, "},{"value":"MarineSediment","label":"Marine, MarineSediment, Delta, Marine Sediment, Ocean, "},{"value":"Midden","label":"Midden, "},{"value":"MolluskShell","label":"MolluskShells, bivalve, MolluskShell"},{"value":"Other","label":"Marl, Meadow, Archaeological, Coast, Farmland, Forest, Sediment, Spring, Valley, , Other"},{"value":"Peat","label":"Wetland, Bog, Fen, Marsh, Mire, Peat, Swamp, peat"},{"value":"Sclerosponge","label":"Sclerosponge, sclerosponge"},{"value":"Shoreline","label":"LakeDeposit, LakeDeposits, Shoreline, lake levels"},{"value":"Speleothem","label":"Cave, Speleothem, speleothems"},{"value":"TerrestrialSediment","label":"Paleosol, Dune, Loess, TerrestrialSediment, Terrestrial Sediment, "},{"value":"Wood","label":"Wood, tree ring, tree"}]

var variablelist = [{"value":"10Be","label":"10Be"},{"value":"230Th/232Th","label":"230Th/232Th"},{"value":"230Th/238U","label":"230Th/238U"},{"value":"232Th","label":"232Th"},{"value":"238U","label":"238U"},{"value":"uncertaintyHigh50","label":"uncertaintyHigh50,50% confidence interval upper bound,0.25_quantile_dust_flux,Precip dD 75 CI,0.75_quantile_dust_flux"},{"value":"uncertaintyLow1s","label":"uncertaintyLow1s,68% confidence interval lower bound,age_y_bp-1s,Q0.16,Q0.16, ice volume adjusted,Q0.16, ice volume and vegetation adjusted,dDP_1s_lower,deltaT - 1 sigma,precip_1s_lower,p-SD,P-SD,T.MinusSD,T-SD,Temperature 1 sigma range low"},{"value":"uncertainty1s","label":"uncertainty1s,68% confidence interval margin of error,C23 stdev,stdev C24,C31 δ13C std dev,C31 δ13C Std Dev,C31d13Csd,C33 δ13C Std Dev,C29 d13C std dev,C31 d13C std dev,C29 δD std dev,dD std dev,C23 δD std dev,C24 d2H stdev,C25 δD std dev,C29 δD Std Dev,C29 δD std dev [±],C31 δD std dev,C31 δD Std Dev,C33 δD Std Dev,C29 dD std dev,StDev C28 dD,d excess stdev,MBTsd,Mg_Ca_sd,MAP1-sigma,precipitation std,precipitation std (with H-set),WMT1-sigma,U371sigmaUncertainty-,CBTsd,stdev weighted average,SD_anomaly,std,stdDev,stdDev___,SE,SD,stdevC24,stdevC26,stdevC28,from_68,2H_dino_1sig,to_68,stdevC25,stdevC27,stdevC29,stdevC31,sd,C30 dD std dev,C31 dD std dev,C25 stdev,stdev C26,C27 stdev,stdev C28,C29 stdev,d13C_C31_sd,C29 δ13C std dev,C29 δ13C Std Dev,C29 δ13C std dev [±]"},{"value":"uncertaintyHigh1s","label":"uncertaintyHigh1s,68% confidence interval upper bound,age_y_bp+1s,Q0.84,Q0.84, ice volume adjusted,Q0.84, ice volume and vegetation adjusted,dDP_1s_upper,deltaT + 1 sigma,p+SD,P+SD,precip_1s_uppper,T+SD,Temperature 1 sigma range high,T.PlusSD,precip_1s_upper"},{"value":"Rb87/Sr86","label":"Rb87/Sr86,87Rb/86Sr,Rb/Sr"},{"value":"uncertaintyLow90","label":"uncertaintyLow90,90% confidence interval lower bound,age_5thpercentile,age_95thpercentile,age97.5"},{"value":"uncertaintyHigh90","label":"uncertaintyHigh90,90% confidence interval upper bound,pcpanomCI95"},{"value":"uncertaintyLow95","label":"uncertaintyLow95,95% confidence interval lower bound,lowerErr2,pcpanomCI5,age_2.5,age2.5,age_calBP95-,95LowerAge,age95ConfMin,minAge95,d13C_2.5,d18O_2.5,Q0.025,Q0.025, ice volume adjusted,Q0.025, ice volume and vegetation adjusted,Precip dD 25 CI,0.025_quantile_dust_flux,lower95"},{"value":"uncertainty2s","label":"uncertainty2s,95% confidence interval margin of error,MAP2-sigma,WMT2-sigma,from_95,2 sigma,to_95"},{"value":"uncertaintyHigh95","label":"uncertaintyHigh95,95% confidence interval upper bound,age_97.5,age_calBP95+,95UpperAge,age95conMax,max_age_95,maxAge95,d13C_97.5,d18O_97.5,Q0.975,Q0.975, ice volume adjusted,Q0.975, ice volume and vegetation adjusted,0.975_quantile_dust_flux,upper95"},{"value":"accumulation","label":"accumulation,accumulation rate,Accumulation rate ice (kg/m2/yr),acc,Accumulation,Ice Accumulation"},{"value":"age","label":"age,ageMedian,ageOriginal,ageMedianBacon,agelinInterp,ageBchron,agecopRa,ageDuplicate,ageStalAge,ageBacon,agelinReg,ageOxCal,Age,medianAge,ageEnsemble,ageMarine09,Median cal age,SHCal04Age,age_alt,age_Calibrated,Age_original,ageOther,ageRounded,IntCal09Age,Marine09,varveCountedAgeAD0x2FBC,varveCountedAgeKa"},{"value":"Uk37","label":"Uk37,alkenone unsaturation index Uk37,UK37-SFS Values,UK37,sumUK37"},{"value":"Uk37'","label":"Uk37',alkenone unsaturation index Uk37 prime,UK'37"},{"value":"aluminum","label":"aluminum,Al,AlProp,Al peak area"},{"value":"Al2O3","label":"Al2O3,aluminum oxide,AL2O3"},{"value":"ammonium","label":"ammonium,NH4_"},{"value":"amps","label":"amps,ampere,Amps"},{"value":"ARM/IRM","label":"ARM/IRM,anhysteretic remanent magnetization/isothermal remanent magnetization,arm_irm"},{"value":"aragonite","label":"aragonite,Aragonite"},{"value":"arsenic","label":"arsenic,ppm As,As"},{"value":"ARSTAN","label":"ARSTAN,ARSTAN chronology method,ARS"},{"value":"ACL","label":"ACL,average chain length,AverageChainLength20to30,AverageChainLength20to32,ACL (27-33),ACL25-35,ACL27-31,ACLC22-30,Average Chain Length"},{"value":"RBAR","label":"RBAR,average correlation coefficient,RBar"},{"value":"barium","label":"barium,Ba,Ba (ppm),ppm Ba,Ba peak area"},{"value":"Ba/Al","label":"Ba/Al,barium/aluminum,ppmBa/%Al"},{"value":"Ba/Ca","label":"Ba/Ca,barium/calcium,Ba_Ca,log_BaCa,BaCa"},{"value":"beryllium","label":"beryllium,ppm Be"},{"value":"BSi","label":"BSi,biogenic silica,Bsi_3pt,Bsi_Raw,Inferred BSi,BioSi"},{"value":"boron","label":"boron,B"},{"value":"BIT","label":"BIT,branched and isoprenoid tetraether index,BITindex,BITindex-3pt"},{"value":"brGDGT-Ia","label":"brGDGT-Ia,branched glycerol dialkyl glycerol tetraether,brGDGTIa,Ia"},{"value":"brGDGT-Ib","label":"brGDGT-Ib,branched glycerol dialkyl glycerol tetraether,brGDGTIb,Ib,br1020,Br1020"},{"value":"brGDGT-Ic","label":"brGDGT-Ic,branched glycerol dialkyl glycerol tetraether,Ic"},{"value":"brGDGT-IIa5me","label":"brGDGT-IIa5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIa,brGDGTIia,IIa,br1036,Br1036"},{"value":"brGDGT-IIa6me","label":"brGDGT-IIa6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIa',IIa'"},{"value":"brGDGT-IIb5me","label":"brGDGT-IIb5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIb,brGDGTIib,IIb"},{"value":"brGDGT-IIb6me","label":"brGDGT-IIb6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIb',IIb'"},{"value":"brGDGT-IIc5me","label":"brGDGT-IIc5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIc,IIc"},{"value":"brGDGT-IIc6me","label":"brGDGT-IIc6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIc',IIc'"},{"value":"brGDGT-IIIa5me","label":"brGDGT-IIIa5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIa,brGDGTIIIa,IIIa,br1050,Br1050"},{"value":"brGDGT-IIIa6me","label":"brGDGT-IIIa6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIa',IIIa'"},{"value":"brGDGT-IIIb5me","label":"brGDGT-IIIb5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIb,brGDGTIIIb,IIIb,br1048,Br1048"},{"value":"brGDGT-IIIb6me","label":"brGDGT-IIIb6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIb',IIIb'"},{"value":"brGDGT-IIIc5me","label":"brGDGT-IIIc5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIc,IIIc"},{"value":"brGDGT-IIIc6me","label":"brGDGT-IIIc6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIc',IIIc'"},{"value":"bromine","label":"bromine,Br"},{"value":"C20n-alkanoicAcid","label":"C20n-alkanoicAcid,C20 n-alkanoic acid,C20 n,C20FAMEconcentration,C20 concentration,C20 FAME Concentration,C20concentration,C20n,C20SEM,C20 SEM,C20n-alkenoicAcid"},{"value":"C21n-alkanoicAcid","label":"C21n-alkanoicAcid,C21 n-alkanoic acid,C21FAMEconcentration,C21 concentration,C21 FAME Concentration"},{"value":"C22n-alkanoicAcid","label":"C22n-alkanoicAcid,C22 n-alkanoic acid,C22 n,C22FAMEconcentration,C22 FAME Concentration,C22concentration,C22n,C22SEM,C22 SEM"},{"value":"C23n-alkanoicAcid","label":"C23n-alkanoicAcid,C23 n-alkanoic acid,C23FAMEconcentration,C23 concentration,C23 FAME Concentration,C23 n,C23C31"},{"value":"C24n-alkanoicAcid","label":"C24n-alkanoicAcid,C24 n-alkanoic acid,nC24,C24 n,C24FAMEconcentration,C24 FAME Concentration,C24concentration,C24n,C24SEM,C24 concentration,C24 SEM,n C24"},{"value":"C25n-alkanoicAcid","label":"C25n-alkanoicAcid,C25 n-alkanoic acid,C25FAMEconcentration,C25 concentration,C25 FAME Concentration,C25 n"},{"value":"C26n-alkanoicAcid","label":"C26n-alkanoicAcid,C26 n-alkanoic acid,nC26,C26 n,C26FAMEconcentration,C26 FAME Concentration,C26concentration,C26n,C26OH0x2F0x28C26OH0x2BC290x29,C26SEM,C26 concentration,C26 SEM,n C26"},{"value":"C27n-alkanoicAcid","label":"C27n-alkanoicAcid,C27 n-alkanoic acid,C27FAMEconcentration,C27 concentration,C27 FAME Concentration,C27 n"},{"value":"C28n-alkanoicAcid","label":"C28n-alkanoicAcid,C28 n-alkanoic acid,nC28,C28 n,C28FAMEconcentration,n-C28,n C28,C28 FAME Concentration,C28concentration,C28n,C28SEM,nC28_err,nC28_rep,C28 concentration,C28 SEM"},{"value":"C29n-alkanoicAcid","label":"C29n-alkanoicAcid,C29 n-alkanoic acid,C29FAMEconcentration,C29 concentration,C29 FAME Concentration,C29 n"},{"value":"C30n-alkanoicAcid","label":"C30n-alkanoicAcid,C30 n-alkanoic acid,C30 n,C30FAMEconcentration,C30 FAME Concentration,C30concentration,C30n,C30SEM,nC30_rep,C30 concentration,C30 SEM"},{"value":"C31n-alkanoicAcid","label":"C31n-alkanoicAcid,C31 n-alkanoic acid,C31FAMEconcentration,C31 concentration,C32FAMEconcentration"},{"value":"C37Alkenone","label":"C37Alkenone,C37 alkenone,C37.concentration,totalC37"},{"value":"C37:2Alkenone","label":"C37:2Alkenone,C37:2 alkenone,C37:2"},{"value":"C37:3aAlkenone","label":"C37:3aAlkenone,C37:3 alkenone,C37:3a"},{"value":"C37:3bAlkenone","label":"C37:3bAlkenone,C37:3 alkenone,C37:3b"},{"value":"C37:4Alkenone","label":"C37:4Alkenone,C37:4 alkenone,C370x3A4,C34:4"},{"value":"cadmium","label":"cadmium,Cd,Cd MAR (ug/cm2/ky),ppm Cd"},{"value":"calcificationRate","label":"calcificationRate,calcification rate,calcification"},{"value":"calcite","label":"calcite,Calcite"},{"value":"calcium","label":"calcium,Ca,CaProp,% Ca-detr,% Ca-ex,Ca peak area,Ca__,Ca  peak area"},{"value":"CaCO3","label":"CaCO3,calcium carbonate,% CaCO3-ex,CaCO3-IC"},{"value":"CaO","label":"CaO,calcium oxide"},{"value":"Ca/K","label":"Ca/K,calcium/potassium"},{"value":"Ca/Sr","label":"Ca/Sr,calcium/strontium"},{"value":"Ca/Ti","label":"Ca/Ti,calcium/titanium,Ti/Ca,Ca/Ti-z"},{"value":"carbon","label":"carbon,C,% TC,% Total C,%_tc,x_C"},{"value":"CPI","label":"CPI,carbon preference index,CarbonPreferenceIndex20to30,CarbonPreferenceIndex20to32,CPI (27-33),CPI_25-33,CPI22-30"},{"value":"C/N","label":"C/N,carbon/nitrogen,molarCN,C_N,C/N organic"},{"value":"carbonate","label":"carbonate,% Carbonate,carb%"},{"value":"charcoal","label":"charcoal,chacoal_influx"},{"value":"chloride","label":"chloride"},{"value":"chlorin","label":"chlorin"},{"value":"chlorine","label":"chlorine,Cl,Cl_"},{"value":"chromium","label":"chromium,Cr,ppm Cr"},{"value":"circulationIndex","label":"circulationIndex,circulation index,GoE,GoF"},{"value":"clay","label":"clay,%_clay,Clay,x_Clay"},{"value":"cobalt","label":"cobalt,Co,ppm Co"},{"value":"elevation","label":"elevation,collection elevation,elevation sample,elevation a.s.l."},{"value":"concentration","label":"concentration,concentration unit,Concentration (C25-35),Friedel-3-ene concentration,Hop-17(21)-ene concentration"},{"value":"copper","label":"copper,ppm Cu"},{"value":"correction","label":"correction,corrected,hasAragoniteCorrection,hasAragoniteCorrectionComposite,Iso adjustment for ocean calibration,Years for ocean correction"},{"value":"correlationCoefficient","label":"correlationCoefficient,correlation coefficient,corrs"},{"value":"count","label":"count,abundance,Numbe_counted,number,Number_counted,numInZone,Slide count,Varve_number,count_analyses_B3,count_analyses_C2,count_analyses_C3,count_analyses_C5,count_analyses_C6,sampleDensity,total,Total_grains_counted,total_non_Chaetoceros_counted,total_xount,TotalAmmoniaBeccarii"},{"value":"sampleCount","label":"sampleCount,count,num_samples"},{"value":"CBT","label":"CBT,cyclization index of branched tetraethers"},{"value":"d13C","label":"d13C,delta 13C,d13CComposite,d13CPrecisionComposite,d13CStandardComposite,d13c_pachyderma,planktic.d13C,d13c_bulloides,d13c_sacculifer,d13c_ruber_pink,C29 δ13C,d13c_ruber,C31 δ13C,D13C,d13CPisid,C33 δ13C,d13C bulk calcite,d13C C18 FAME,d13C C18 FAME SEM,d13C C20 FAME,d13C C20 FAME SEM,d13C C21 alkane,d13C C21 alkane SEM,d13C C22 FAME,d13C C22 FAME SEM,d13C C23 alkane,d13C C23 alkane SEM,d13C C24 FAME,d13C C24 FAME SEM,d13C C25 alkane,d13C C25 alkane SEM,d13C C26 FAME,d13C C26 FAME SEM,d13C C27 alkane,d13C C27 alkane SEM,d13C C28 FAME,d13C C28 FAME SEM,d13C C29 alkane,d13C C29 alkane SEM,d13C C30 FAME,d13C C30 FAME SEM,d13C C31 alkane,d13C C31 alkane SEM,d13C C32 FAME,d13C C32 FAME SEM,d13C C33 alkane,d13C C33 alkane SEM,d13C C34 FAME,d13C C34 FAME SEM,d13C C35 alkane,d13C C35 alkane SEM,d13C carbonate,D13C_C30,d13C organic,d13C ostracod,d13C_C31,d13c_dutertrei,d13C_org,d13c_pachyderma_d,d13Ccarb,d13CleafwaxC27,d13CleafwaxC27err,d13CleafwaxC29,d13CleafwaxC29err,d13CleafwaxC31,d13CleafwaxC31err,d13CleafwaxC33,d13CleafwaxC33err,d13CMean,Friedel-3-ene d13C,Hop-17(21)-ene d13C,Bulk OM d13C,C21 d13C,C23 d13C,C25:2 d13C,C28 d13C vs. VPDB,C29 d13C,C31 d13C,CDR3_d13C,d13/12C,Taraxer-14-ene d13C,δ13C n-alkanes,δ13C n-alkanes std dev,d13C bulk,d13C C25,d13C C27,d13C C29,d13C C31,d13C VPDB,D13C_C28,D13C_FAME,d13Cwax,C13bulk,C25 d13C,C27 d13C,C31d13C_PDB"},{"value":"d15N","label":"d15N,delta 15N,d15N/14N,dN15,dN15_corrected,Bulk OM d15N"},{"value":"d18O","label":"d18O,delta 18O,D18OIVC,d18o_ruber,d18o_pachyderma,d18OComposite,planktic.d18O,d18o_bulloides,d18o_sacculifer,d18O_sw,d18O_annual,D18O,d18o_ruber_pink,d18o_dutertrei,d18o_pachyderma_d,d18O_sw_annual,d18o_inflata,d18O_PDB,d18o_obliquiloculata,d18O_SMOW,d18O_swcorr,d18Ocarb,d18OPisid,d18Osw-sl-g.rubw,bagd18O,d180_corrc,d18O  encrustation,d18O Avg,d18O bulk calcite,d18O carbonate,d18O carbonate corrected for dolomite,d18O Chironomid,d18O ostracod,d18O pore ice sw corr,d18O_210yr,d18o_acicula,d18o_crassaformis,d18O_Gb,d18o_mabahethi,d18o_marginata,d18o_menardii,d18o_peregrina,d18o_quinqueloba,d18o_ruber_lato,d18o_ruber_stricto,d18o_tumida,d18O_vPDB,d18OBsi,d18Odiatom,d18Og.rub,d18Omean,d18Osw-g.rub,d18OTerrestrialGastropods,d18Otr,d18Otr-,d18Otr+,G. ruber w δ18O [‰ PDB],Gbulloidesd18O,CDR3_d18O,dd18O5pt,Ndutertreid18O,nonReliabled18O,ruberD18,WR11_d18O,x18O,x18ORub_,δ18O,Chironomid d18O,d18O (Sea Level Corrected),D18O_corrected,d18O VPDB,d18O_Grass_leaf,d18O_Sphagnum,d18O_vp–sp,d18O chironomid,d18O Lake water,d18O pore ice,d18Osw"},{"value":"d234U","label":"d234U,delta 234U"},{"value":"d2H","label":"d2H,delta 2H,dD,C29 δD,dDwax_iv,C31 δD,dDP,d2H C29,C26 d2H,C30 d2H,d2H C27,dD_C31,dD_swcorr,bagdD,C22 d2H,C24 d2H,C25 d2H,C28 d2H,C28_dD,C29 dD,d2H C20,d2H C23,dDC29,dDC31,d2H avg,d2H C20 FAME,d2H C20 FAME SEM,d2H C21 alkane,d2H C21 alkane SEM,d2H C22 FAME,d2H C22 FAME SEM,d2H C23 alkane,d2H C23 alkane SEM,d2H C24 FAME,d2H C24 FAME SEM,d2H C25,d2H C25 alkane,d2H C25 alkane SEM,d2H C25 error,d2H C26 FAME,d2H C26 FAME SEM,d2H C27 alkane,d2H C27 alkane SEM,d2H C27 error,d2H C28 FAME,d2H C28 FAME SEM,d2H C29 alkane,d2H C29 alkane SEM,d2H C29 error,d2H C30 FAME,d2H C30 FAME SEM,d2H C31,d2H C31 alkane,d2H C31 alkane SEM,d2H C31 error,d2H C32 FAME,d2H C32 FAME SEM,d2H C33 alkane,d2H C33 alkane SEM,d2H pore ice,d2H pore ice sw corr,d2H_C16,d2H_C26,d2H_C28,d2H_C30,d2HC30,d2HleafwaxC29,d2HleafwaxC29err,d2HleafwaxC31,d2HleafwaxC31err,d2HleafwaxC33,d2HleafwaxC33err,d2Hsw,dD IV,dDwax_IVC,dD_C31_sd,dD_IVandbio,dD_IVonly,dD_iceVolCorrected,dDwax,dDwax Corrected,dDwax_corr,Friedel-3-ene d2H,Hop-17(21)-ene d2H,C20 d2H,C20 d2H SEM,C21 d2H,C22 d2H SEM,C23 δD,C25 δD,C26 d2H SEM,C27 d2H,C28 d2H SEM,C28_dDIV,C29 d2H,C29 δD Corrected,C29 δD ice volume adjusted,C29 δD ice volume and vegetation adjusted,C29-C31 δD,C30 d2H SEM,C30 dD,dD_C30,C30 dD IV corrected  (3°C),C30 dD IV corrected  (7°C),C31 d2H,C31dD,C31dDsd,C32 dD,C33 δD,nC28_dD,nC30_dD,Taraxer-14-ene d2H,δDaq,δDterr,C31 dD,d2H C22,d2H C25:2,d2H C30,d2H precip,dD_C29,Long chain n-acid avg d2H,Long Chain n-alkane avg d2H,Mid-chain n-acid avg d2H,Midchain n-alkane avg d2H,d2HC24,d2HC26,d2HC28,d2HC29,C20d2H,C22d2H,C23 d2H,C24d2H,C25:2 d2H,C26d2H,C28d2H,C30d2H,Dd,Precip d2H"},{"value":"reservoir","label":"reservoir,delta reservoir age"},{"value":"density","label":"density,Density"},{"value":"depth","label":"depth,depthComposite,Depth,depth_merged,depthice,depthwe,MidpointDepth,Depth blf,depthComp,Composite depth,compositeDepth,Composite Depth,Section depth,depth corrected,depth_cmbs,depth_core1,depth_corr_cm,depth_merge,Composite Depth in Core,Composite depth mid,Composite_depth,Depth_eventFree,cor_depth_cm,depthByCore,DrillHole Depth,mean depth,originalCoreDepth,Section Depth,Core depth,depth_core,Adjusted Depth,drive-depth"},{"value":"depthTop","label":"depthTop,depth at sample end,depth.top,depth_top_m,depth_top,Composite depth top,Section depth top,top,Top,Top Depth,topDepth,uncorrected_depth_top,top depth in section,Top_depth,logdepthtop,logdepthtop-EDC99,logdepttop"},{"value":"depthBottom","label":"depthBottom,depth at sample start,depth.bottom,depth_bot,bottomDepth,depth_bottom,bot,Bot,Bottom Depth,Composite depth bottom,Section depth bottom,uncorrected_depth_bot,bottom depth in section,Bottom_depth"},{"value":"deuteriumExcess","label":"deuteriumExcess,deuterium excess,d-excess,bagDexcess,d-excess_swcorr,deutEx,dxs,d-excess pore ice,d-excess pore ice sw corr,d-excess sw"},{"value":"diatom","label":"diatom,¾nthic,%fresh,%Indif.,%Saline,¾nth.dia,%plank.dia,%saline.dia,SumDiatoms"},{"value":"diatomCount","label":"diatomCount,diatom index,seaIceDiatoms,diatom_abundance,Diatoms_per_traverse"},{"value":"diatomRatio","label":"diatomRatio,diatom ratio"},{"value":"dolomite","label":"dolomite,% Dolomite,dolo-wt%"},{"value":"sedimentDry","label":"sedimentDry,dry sediment,clastic,clastic_flux,mass dry,mass dry >1mm,mass dry 106 to 1000 um,mass dry 63 to 106 um,massDry,massDry_1mm,dry sample mass,sedimentWeight"},{"value":"duration","label":"duration,duration unit,yearsPerSample"},{"value":"dust","label":"dust,DMAR,dustFlux,0.50_quantile_dust_flux"},{"value":"DWHI","label":"DWHI,ecosystem index"},{"value":"landscapeCover","label":"landscapeCover,ecosystem quantity,OpenVegetation___"},{"value":"percent","label":"percent,ecosystem quantity,WoodyCover___"},{"value":"ElNinoEvent","label":"ElNinoEvent,El Niño event,ENSO_events"},{"value":"PC1","label":"PC1,empirical orthogonal function,droughtIndex (PC1),P1,PC1gs,PCA1,Hz-ic1"},{"value":"PC2","label":"PC2,empirical orthogonal function,Hz-ic2,PCA2"},{"value":"PC3","label":"PC3,empirical orthogonal function,Hz-ic3"},{"value":"PC4","label":"PC4,empirical orthogonal function,Hz-ic4"},{"value":"PC5","label":"PC5,empirical orthogonal function,Hz-ic5"},{"value":"PC6","label":"PC6,empirical orthogonal function,Hz-ic6"},{"value":"equilibriumLineAltitude","label":"equilibriumLineAltitude,equilibrium line altitude,ELA,ELA_alt"},{"value":"eventLayer","label":"eventLayer,event layer,layer,layer_type"},{"value":"EPS","label":"EPS,expressed population signal"},{"value":"feldspar","label":"feldspar,feldspar group"},{"value":"fluorine","label":"fluorine,F_,F"},{"value":"foraminifera","label":"foraminifera,foraminifer,Foram"},{"value":"gamma","label":"gamma,gamma radiation"},{"value":"globigerinoidesBulloides","label":"globigerinoidesBulloides,Globigerinoides bulloides,G. bulloides"},{"value":"globigerinoidesRuber","label":"globigerinoidesRuber,Globigerinoides ruber,Gruber"},{"value":"GDGT","label":"GDGT,glycerol dialkyl glycerol tetraether,brGDGT"},{"value":"grainSize","label":"grainSize,grain size,<4 um,>63 um,GrainSizeMode,D50,<2 um,<2um,Grain size mean,<16 μm,250-31 um,63-4 um"},{"value":"lithics","label":"lithics,grain size,%_lithics,Lithic Flux,Lithics"},{"value":"grayscale","label":"grayscale,grayscale20lp_detrended,grey_scale"},{"value":"growing degree days","label":"growing degree days,GDD5"},{"value":"growthRate","label":"growthRate,growth rate,GrowthRate"},{"value":"humidificationIndex","label":"humidificationIndex,humidification index,HumidificationIndex,HIndex,Hindex"},{"value":"iceMelt","label":"iceMelt,ice melt,melt,ice_melt_fraction,meltLayerFrequency,meltLayers"},{"value":"IP25","label":"IP25,ice proxy with 25 carbon atoms,IP25_flux"},{"value":"iceRaftedDebris","label":"iceRaftedDebris,ice rafted debris,IRD"},{"value":"mineralogy","label":"mineralogy,identified mineral,mineral_flux,mineralogyComposite"},{"value":"inc/coh","label":"inc/coh,incoherent:coherent scattering,Inc/Coh"},{"value":"TIC","label":"TIC,inorganic carbon,% IC"},{"value":"ITCZ","label":"ITCZ,Intertropical Convergence Zone index,ITCZ_index"},{"value":"iron","label":"iron,Fe,Fe peak area,FeProp"},{"value":"Fe2O3","label":"Fe2O3,iron(III) oxide"},{"value":"Fe/Al","label":"Fe/Al,iron/aluminum"},{"value":"Fe/Ca","label":"Fe/Ca,iron/calcium,ln(Fe/Ca),FeCa_log,FeCa,log(Fe/Ca)"},{"value":"Fe/Mn","label":"Fe/Mn,iron/manganese"},{"value":"Fe/K","label":"Fe/K,iron/potassium,ln(Fe/K)"},{"value":"IRM","label":"IRM,isothermal remanent magnetization,irm,IRM_softFlux"},{"value":"lakeArea","label":"lakeArea,lake area"},{"value":"lakeLevel","label":"lakeLevel,lake level,depth.lake,lakeStatus,lakeLevelRelative,LakeDepth,LakeLevel_cm_,Lake Level,Lake Level a.s.l."},{"value":"lanthanum","label":"lanthanum,ppm La"},{"value":"MXD","label":"MXD,latewood density"},{"value":"latitude","label":"latitude,latitude sample"},{"value":"layerThickness","label":"layerThickness,layer thickness,eventLayerThick,Fld lay thick,Flood lay (annual),Flood lay (fall),Flood lay (spring),Flood lay (summer),Flood lay (winter),floodLayThick,debrisLayThick,Lamina_thickness,LaminaThickenss"},{"value":"lead","label":"lead,ppm Pb"},{"value":"LDI","label":"LDI,long-chain diol index"},{"value":"longitude","label":"longitude,longitude sample"},{"value":"LOI","label":"LOI,loss on ignition,LOI550,LOI950"},{"value":"magnesium","label":"magnesium,Mg,% Mg,%Mg,detrendMg,Mg__,MgDetrended"},{"value":"MgO","label":"MgO,magnesium oxide"},{"value":"Mg/Ca","label":"Mg/Ca,magnesium/calcium,mgca_pachyderma,mgca_bulloides,mgca_dutertrei,mgca_sacculifer,mgca_inflata,mgca_ruber_lato,mgca_ruber_pink,mgca_ruber_stricto,mgca_crassaformis,mgca_obliquiloculata,mgca_pachyderma_d,CDR3_MgCa,Mg/Ca Raw,MgCa,mgca_truncatulinoides,NdutertreiMg/Ca,mgca_ruber,Mg_Ca,log_MgCa,planktic.MgCa"},{"value":"MS","label":"MS,magnetic susceptibility,Avg_MS,AVG_MS_DRS1_2A_3_2B_4,MassMagSus,SI,Magnetic Susceptibility"},{"value":"manganese","label":"manganese,Mn,ppm Mn,% Mn"},{"value":"MnO","label":"MnO,manganese oxide"},{"value":"Mn/Fe","label":"Mn/Fe,manganese/iron,MnFe"},{"value":"Mn/Ti","label":"Mn/Ti,manganese/titanium,MnTi"},{"value":"MAR","label":"MAR,mass per area per time unit,Bulk MAR,bulkMAR,CordMAR,Mo MAR (ug/cm2/ky),massacum"},{"value":"MBT","label":"MBT,methylation index of branched tetraethers,MBT',MBT'5Me"},{"value":"AET/PET","label":"AET/PET,missing"},{"value":"Al/Ca","label":"Al/Ca,aluminum/calcium"},{"value":"Al/Si","label":"Al/Si,missing,ln(Al/Si)"},{"value":"Artemesia/Ambrosia","label":"Artemesia/Ambrosia,missing,ArtAmb"},{"value":"ash","label":"ash,missing"},{"value":"Ba/Sr","label":"Ba/Sr,missing"},{"value":"bubbleNumberDensity","label":"bubbleNumberDensity,missing"},{"value":"bulkDensity","label":"bulkDensity,missing,bulk density"},{"value":"C25_2n-alkanoicAcid","label":"C25_2n-alkanoicAcid,missing,C25:2 concentration"},{"value":"Cd/Mn","label":"Cd/Mn,missing,ppm Cd/% Mn"},{"value":"Ca/Mg","label":"Ca/Mg,missing"},{"value":"core","label":"core,missing,CoreName,Core ID,core name,DUNE_A,Core Name,Core Section,Core_number,CoreSect1H,originalCoreName,Stal.ID,Core name,Core"},{"value":"d2HUncertaintyHigh80","label":"d2HUncertaintyHigh80,missing,Precip dD 90 CI"},{"value":"d2HUncertaintyLow80","label":"d2HUncertaintyLow80,missing,Precip dD 10 CI"},{"value":"Dd2H","label":"Dd2H,missing,ΔδDterr-aq"},{"value":"deleteThis","label":"deleteThis,missing,average C26 C28,CAL,A,Calibrated,IMON1953/3,interval,SAUG/3,SETE/3,SFEV/3,SHIV/3,TETE/3,TFEV/3,THIV/3,hobdob,LazerProfiler,noID,RCS.ars,Unkown"},{"value":"deltaRelativeHumidity","label":"deltaRelativeHumidity,missing,∆RH_mid"},{"value":"deltaTemperature","label":"deltaTemperature,missing,deltaT"},{"value":"dryBulkDensity","label":"dryBulkDensity,missing,DBD,Dry Bulk Density,dbd,dry_bd,EstDryBD"},{"value":"epsilonC28C22","label":"epsilonC28C22,missing,Epsilon C28-C22,Epsilon28-22"},{"value":"epsilonC28C24","label":"epsilonC28C24,missing,Epsilon C28-C24"},{"value":"epsilonC29C23","label":"epsilonC29C23,missing,Epsilon C29-C23"},{"value":"Eu/Zr","label":"Eu/Zr,missing,Eu/Zr-z"},{"value":"event","label":"event,missing"},{"value":"facies","label":"facies,missing,lithology,Facies,lithologic unit"},{"value":"flood","label":"flood,missing,M-flood,M-flood 200 yr avg,M-flood 30 yr sum,P-flood,P-flood 200 yr avg,P-flood 30 yr sum,floods"},{"value":"GDGT-0/Cren","label":"GDGT-0/Cren,missing"},{"value":"glacierCoverage","label":"glacierCoverage,missing"},{"value":"hasGap","label":"hasGap,missing"},{"value":"hasHiatus","label":"hasHiatus,missing,hasHiatusComposite"},{"value":"hole","label":"hole,missing"},{"value":"isReliable","label":"isReliable,missing,ReliabIeYN1,reliable,ReliabIeYN2,reliable 1,reliable 2,reliable_1,reliable_2,reliable_3,reliable_4,Reliable?"},{"value":"JulianDay","label":"JulianDay,missing"},{"value":"K37","label":"K37,missing,K37s"},{"value":"lakeTrend","label":"lakeTrend,missing"},{"value":"lakeVolume","label":"lakeVolume,missing"},{"value":"Mn/Mo","label":"Mn/Mo,missing"},{"value":"N/C","label":"N/C,missing,NC"},{"value":"organicNitrogen","label":"organicNitrogen,missing,Norg"},{"value":"Picea/Artemisia","label":"Picea/Artemisia,missing,Picea/Artemesia"},{"value":"Picea/Pinus","label":"Picea/Pinus,missing"},{"value":"Pinus/Artemisia","label":"Pinus/Artemisia,missing"},{"value":"Poaceae/Ephedra","label":"Poaceae/Ephedra,missing"},{"value":"pollen","label":"pollen,missing,PinusTotal"},{"value":"R570/R630","label":"R570/R630,missing,R570_630"},{"value":"R650/R700","label":"R650/R700,missing,R650_700"},{"value":"RABD660670","label":"RABD660670,missing,R660_670,RABD660_670,RABD660;670 index"},{"value":"section","label":"section,missing,core_section,Section,section name,Sec label,Section [#],Section #,Section number"},{"value":"segmentLength","label":"segmentLength,missing,segment"},{"value":"sequence","label":"sequence,missing,Pollen Sequence"},{"value":"site","label":"site,missing,LakeName,Site,CoreSite,siteName,SiteName,Drilling project,Region,site/hole"},{"value":"siteCount","label":"siteCount,missing,#ofSites"},{"value":"TOC/TN","label":"TOC/TN,missing"},{"value":"totalCarbon","label":"totalCarbon,missing,TC"},{"value":"totalNitrogen","label":"totalNitrogen,missing,TN"},{"value":"treeCover","label":"treeCover,missing,TreeCover"},{"value":"wetBulkDensity","label":"wetBulkDensity,missing,WetBD"},{"value":"molybdenum","label":"molybdenum,Mo,Mo_xs,ppm Mo"},{"value":"CCA1","label":"CCA1,multivariate eigenvector-based variable,caaxis1"},{"value":"CCA2","label":"CCA2,multivariate eigenvector-based variable,caaxis2"},{"value":"needsToBeChanged","label":"needsToBeChanged,NA,BS,BS_COMX,BS_Landscape_Openness,Di,DryElements,E2Hterr-2Haq,Eaq-p,eSEP_PLS_C2,eSEP_WMAT,HC/G,HII (H-set),HII (N-set),HII std (H-set),HII std (N-set),HulunNuur,aridity,d13o_pachyderma,distance,10%max,10%min,20%max,20%min,30%max,30%min,50%max,50%min,80%max,80%min,C170x2D28,calibrated,CI,CMT,CT,JulT-eSEP,Laminae,PPexp,RRA,tempSource,TSAR5pt,water,WMT,thisShouldntBeEmpty,TS,Unit,unnamed,-,100yrSum,10YrRun.Avg.,A odd (25-35),Alkenones,Analogues,Analogues#,bag,Bag,bagDepth,benth,Benthic,Cal,CAST1,CAST2,CMT_max,CMT_min,CMTmax,CMTmin,D,d0x2800x2E10x29,d0x2800x2E50x29,d0x2800x2E90x29,DEC,dln,Intv0x2E,kyryr BP2,log[EM3/(EM1+EM2)],LORCA,lower band,LSR (cm/ky),Lyc.added,Mag0x2E,Mark add,Mark found,Mean consensus,Mean_anomaly,mineral,Minidiscus?,Mode,MoistElements,MST,n-Alkane,NE.ars,OEP,s,S52,stage,Taraxer-14-ene concentration,TCT,Th13C,thin-mid,TOTC,Ts,TSAR,TT,Water/relict ice age,x00x2E020xB5m0x2D30x2E890xB5m,x10000x2E010xB5m0x2D20000x2E000xB5m,x1250x2E000xB5m0x2D2490x2E990xB5m,x150x2E600xB5m0x2D300x2E990xB5m,x2500x2E000xB5m0x2D4990x2E990xB5m,x30x2E900xB5m0x2D70x2E790xB5m,x310x2E000xB5m0x2D620x2E490xB5m,x5000x2E000xB5m0x2D10000x2E000xB5m,x620x2E500xB5m0x2D1240x2E990xB5m,x70x2E800xB5m0x2D150x2E590xB5m,drive-type,EM1,EM2,EM3,EMI,IMI,MG0,MShellCrn,Reconstructed,thisShouldntBeEmpty1,WACLS,WACLS_total,WAINV,WAINV_total,WAPLS-2,U_xs"},{"value":"nickel","label":"nickel,ppm Ni"},{"value":"nitrate","label":"nitrate,NO3_"},{"value":"nitrogen","label":"nitrogen,N"},{"value":"notes","label":"notes,entityName,Commentregardingreliability1,CommentRegardingReliability,Commentregardingreliability2,BSi_regime,BSI_regime,CodeName,color,Commentregardingreliability3,Commentregardingreliability4,note,repeats,Reworked,notes_C5"},{"value":"organicCarbon","label":"organicCarbon,organic carbon,C_organic_flux,Corg dens,Acc Rate TOC,TOC,Corg,% OC,% Organic carbon,OC-MAR (g),OC-MAR (mg),TOC_flux,TOCmg,Organic carbon concentration,Total Organic Carbon"},{"value":"RAN15","label":"RAN15,organic compound index"},{"value":"organicMatter","label":"organicMatter,organic matter,OM,organic,%_tom,OM dens"},{"value":"oxygen","label":"oxygen,%O"},{"value":"Paq","label":"Paq,P-aqueous"},{"value":"peat","label":"peat,Peat,peatFlux"},{"value":"pH","label":"pH,pHsoil,soilPH"},{"value":"phosphorus","label":"phosphorus,%P"},{"value":"P/Ca","label":"P/Ca,phosphorus/calcium"},{"value":"totalPollen","label":"totalPollen,pollen,TotalPollen,TreePollen"},{"value":"potassium","label":"potassium,K_,K,KProp,%K,% K,K peak area"},{"value":"K2O","label":"K2O,potassium oxide"},{"value":"K/Al","label":"K/Al,potassium/aluminum,ln(K/Al)"},{"value":"precipitation","label":"precipitation,Pannom,Panom,Precipitation,MAP,P,precip51yr,precip5yr,precipitation (with H-set),precipobs,Summer precipitation,Annual Precipitation,Summer Precipitation,Winter Precipitation,Precip"},{"value":"effectivePrecipitation","label":"effectivePrecipitation,precipitation minus evaporation,effectiveMoisture,Moisture_index,waterBalance"},{"value":"productivity","label":"productivity"},{"value":"composite","label":"composite,proxy composite,hybrid,Hybrid"},{"value":"pyrite","label":"pyrite"},{"value":"quartz","label":"quartz"},{"value":"age14C","label":"age14C,radiocarbon year,c14age,C14age,radiocarbonDatesAD0x2FBC"},{"value":"material","label":"material,reconstruction material,Material"},{"value":"sedimentationRate","label":"sedimentationRate,redimentation rate,sedRate,sed rate,Mean Sedim rate,Sedim rate"},{"value":"reflectance","label":"reflectance,blueIntensity,redness,Brightness,X_radiograph_dark_layer,L,red_color_intensity_units"},{"value":"relativeHumidity","label":"relativeHumidity,relative humidity,RH"},{"value":"residualChronology","label":"residualChronology,residual chronology method,residual"},{"value":"ringWidth","label":"ringWidth,ring width,trsgi,TRW"},{"value":"rubidium","label":"rubidium,Rb,Rb peak area"},{"value":"salinity","label":"salinity,SAUG,SETE,SFEV,SHIV,logSalinity,sss,SSS"},{"value":"sampleID","label":"sampleID,sample identification,Sample,sisalSampleID,sisalSampleIDComposite,OriginalSampleID,Sample ID,plotName,label,ID,Lab ID,sample_code,sampleNumber,DateID,Lab Code,sambleID,Sample interval,Sample label,sample_number,sampleIDa,sampleIDb,sampleIDc,samples,smapleID,sample # in section,Sample Label,sample"},{"value":"sand","label":"sand,%_sand,x_Sand,Sand"},{"value":"scandium","label":"scandium,ppm Sc"},{"value":"seaIce","label":"seaIce,sea ice cover,IMON1953,Sea_Ice_conc,Sea_Ice_months"},{"value":"silicon","label":"silicon,Si,SiProp,norm Silicon,Si peak area"},{"value":"Si/Al","label":"Si/Al,silicon/aluminum"},{"value":"Si/Ti","label":"Si/Ti,silicon/aluminum,norm Si/Ti"},{"value":"silt","label":"silt,Silt,%_silt,x_Silt"},{"value":"sodium","label":"sodium,Na,Na_"},{"value":"Na2O","label":"Na2O,sodium oxide"},{"value":"solarIrradiance","label":"solarIrradiance,solar irradiance,SunFrac"},{"value":"zscore","label":"zscore,standard deviation unit,Z_score"},{"value":"cluster","label":"cluster,statistical variable,cluster2"},{"value":"index","label":"index,statistical variable,PLS-1,PLS-2,SM/IlliteChlorite"},{"value":"streamflow","label":"streamflow,discharge,FebQ,AprQ,AugQ,DecQ,JanQ,JulyQ,JuneQ,MarchQ,MayQ,NovQ,OctQ,SeptQ"},{"value":"strontium","label":"strontium,Sr,ppm Sr,SR,Sr (ppm),Sr peak area"},{"value":"Sr/Ca","label":"Sr/Ca,strontium/calcium,CDR3_SrCa,WR11_SrCa,SrCa,log_SrCa,Sr_Ca,SrCa_annual"},{"value":"SO4","label":"SO4,sulfate,SO4__"},{"value":"sulfate","label":"sulfate"},{"value":"sulfur","label":"sulfur,S,Sulfur,Sulphur"},{"value":"S/Ca","label":"S/Ca,sulfur/calcium"},{"value":"temperature","label":"temperature,temperature variable,t-source,temperatureComposite,nonReliabletemperature,Temperature,nonReliableTemperature,deep.temp,T anomaly,TETE,TFEV,THIV,JulTanom,JulTanomLoess,Pollen_T,SST_from_Uk37,Tanom,SST-d18O,APR,AUG,Feb,FRA06 Air Temperature,Ice_core_C,interpolatedTemperature,Jan,JUL,JUN,MAAT,MAT,MAY,MeanT,MSAT,MSAT Russell 2018,nonReliableTemperature 1,nonReliabletemperature 2,nonReliableTemperature_1,nonReliableTemperature_2,nonReliableTemperature_3,nonReliableTemperature_4,NOV,OCT,PLS_C2_temp,SBT,SEP,smoothedTemp,soilTemp,SST_amj,SST_from_planktic0x2Ed18O,SST_from_planktic0x2EMgCa,SST_LDI,subT,Temp Anom 10 CI,Temp Anom 25,Temp Anom 75,Temp Anom 90,Temp Anom Best,Temp Anom FOR15,Temp Anom FRA06,Temp Anom FRA06-TR,temp2,temp2s,tempAv0,tempAv8,temperature 1,temperature 2,temperature_1,temperature_2,temperature_3,temperature_4,temperaturer2,tempK,tempNoElevCorrection,tempNoSourceCorrection,tempPartialCorrect,tempSmooth5,SST,temp,Temp,Tsource"},{"value":"TEX86","label":"TEX86,tetraether index of 86 carbon atoms,tex86l"},{"value":"thickness","label":"thickness,thicknessComposite,Samp thick,sample_thickness,Thickness,Sample thickness"},{"value":"titanium","label":"titanium,Ti,Ti peak area,TiProp,Tiash,Titanium,% Ti,%Ti"},{"value":"TiO2","label":"TiO2,titanium dioxide"},{"value":"Ti/Al","label":"Ti/Al,titanium/aluminum"},{"value":"Ti/Ca","label":"Ti/Ca,titanium/calcium,ln(Ti/Ca),ln(ti/ca),log(Ti/Ca)"},{"value":"dinocyst","label":"dinocyst,total dinocysts,flux_dino"},{"value":"TDS","label":"TDS,total dissolved solids"},{"value":"uncertaintyLow","label":"uncertaintyLow,unspecified error lower bound,lowerErr,Acc min,ageMin,agelinInterpUncertaintyLow,ageBchronUncertaintyLow,agecopRaUncertaintyLow,ageYoung,ageStalAgeUncertaintyLow,ageBaconUncertaintyLow,agelinRegUncertaintyLow,ageOxCalUncertaintyLow,ageUncertaintyLow,age_min,cal_age_range_young,D18O-,D13C-,D18Oivc-,error_younger_age,Age_min,min age,min Age,minAge,age min,age_young,Chironomid d18O min,d18OUncertaintyLow,∆RH_lower,UncertaintyDust0x5B0x250x5D0x28Minus0x29,MinElevM,meltUncertaintyLow,lakeLevelMin,lakeLevelLo,Pmin,PanomMinUncertainty,PannomMinUncertainty,MAP_min,precip-,PannomMin,PanomMin,min RH,SAUG_i,SETE_i,SFEV_i,SHIV_i,IMON1953_i,TETE_i,TFEV_i,THIV_i,tempErrorLower,JAS-,MAT_min,MATmin,temperatureCold,WMT_min,WMTmin,TreeCover_min,errorLow,errorLow2,undertainty_minus,yearBottom,SunFracMin,yearTop"},{"value":"uncertaintyHigh","label":"uncertaintyHigh,unspecified error upper bound,SunFracMax,Acc max,ageOld,agelinInterpUncertaintyHigh,ageBchronUncertaintyHigh,agecopRaUncertaintyHigh,ageStalAgeUncertaintyHigh,ageBaconUncertaintyHigh,agelinRegUncertaintyHigh,ageOxCalUncertaintyHigh,ageUncertaintyHigh,AgeOld,age_max,cal_age_range_old,error_older_age,Age_max,max age,max Age,maxAge,age max,age_old,Chironomid d18O max,d18OUncertaintyHigh,D18O+,D13C+,D18Oivc+,∆RH_upper,UncertaintyDust0x5B0x250x5D0x28Plus0x29,MaxElevM,meltUncertaintyHigh,lakeLevelMax,lakeLevelHi,Pmax,PanomMaxUncertainty,PannomMaxUncertainty,MAP_max,precip+,PannomMax,PanomMax,max RH,SAUG_s,SETE_s,SFEV_s,SHIV_s,IMON1953_s,TETE_s,TFEV_s,THIV_s,tempErrorUpper,JAS+,MAT_max,MATmax,temperatureWarm,tempErrorPlus,WMT_max,WMTmax,TreeCover_max,ageMax,errorUp,errorUp2,uncertainty_plus,upper band,upperErr,upperErr2,year_old"},{"value":"uncertainty","label":"uncertainty,unspecified margin of error,C20 Total Unc,C22 Total Unc,C30 Total Unc,bubbleNumberDensityError,ageUncertainty,Age_uncertainty,Age, uncertainty (±),ageError,ageUncertaintyOther,d13CPrecision,d13CStandard,d13C Error,d13C std dev,13CleafwaxC29-33err,d13C_error,d18OPrecision,d18OStandard,d18OPrecisionComposite,d18OStandardComposite,d18OUncertainty,d18O_error,d18O error,d18O_Grass_leaf_error,d18O_Sphagnum_error,dDUncertainty,dD error,dD unc,nC30_err,d2HleafwaxC28err,DMAR_error,DMAR_uncertainty,Epsilon C28-C22 uncertainty,Epsilon28-22uncertainty,Epsilon C28-C24 uncertainty,Epsilon Uncertainty,lakeAreaError,lakeVolumeError,precipitationUncertainty,Annual Precipitation Error,Summer Precipitation Error,Winter Precipitation error,SrCaUncertainty,temperatureUncertainty,uncertainty.temperature,uncertainty_temperature,JAS_error,T_site_std,tempError,temperature_error,JASerror,UK_error,UK37_error,A_site_std,error,uncertainty_1,uncertainty_2,uncertainty_3,uncertainty_4,error1,error2,error3,err,range,TTerror,Calibration Error,C24 Total Unc,C26 Total Unc,C28 Total Unc"},{"value":"upwelling","label":"upwelling,Upwelling Index"},{"value":"uranium","label":"uranium,U"},{"value":"vanadium","label":"vanadium,ppm V"},{"value":"V/Al","label":"V/Al,vanadium/aluminum"},{"value":"varveThickness","label":"varveThickness,varve thickness,Varve thickness,Varve_width"},{"value":"volume","label":"volume,Samp vol"},{"value":"waterContent","label":"waterContent,water content"},{"value":"waterTableDepth","label":"waterTableDepth,water table depth,Water Table,Water Table Detrended,water wm,water_table_depth,Water_tableDepth"},{"value":"year","label":"year,Year,year start,age_CE,Recon0x2EDate,yearRounded,yearEnsemble,Year b2k"},{"value":"yttrium","label":"yttrium,ppm Y"},{"value":"zinc","label":"zinc,ppm Zn"},{"value":"zirconium","label":"zirconium,Zr,ppm Zr"},{"value":"Zr/Al","label":"Zr/Al,zirconium/aluminum"},{"value":"Zr/Rb","label":"Zr/Rb,zirconium/rubidium"},{"value":"acinocyclus.Curvatulus","label":"acinocyclus.Curvatulus,Acinocyclus. curvatulus"},{"value":"n-alkane","label":"n-alkane"},{"value":"n-alkaneRatio","label":"n-alkaneRatio,Norm33"},{"value":"ArtemesiaChenopodiumSar","label":"ArtemesiaChenopodiumSar,ArtChenoSar"},{"value":"Picea","label":"Picea"},{"value":"Artemisia","label":"Artemisia"},{"value":"Pinyon","label":"Pinyon"},{"value":"broadleavedWoodyCover","label":"broadleavedWoodyCover,BroadleavedWoodyCover___"},{"value":"Quercus","label":"Quercus"},{"value":"abies","label":"abies,Abies"},{"value":"actinocyclusCurvatulus","label":"actinocyclusCurvatulus,Actinocyclus_curvatulus"},{"value":"alnus","label":"alnus,Alnus"},{"value":"azpeitiaNodulifer","label":"azpeitiaNodulifer,Azpeitia_nodulifer"},{"value":"Compositae","label":"Compositae"},{"value":"Roperia_tesselata","label":"Roperia_tesselata,Roperia tesselata"},{"value":"Sequoia","label":"Sequoia"},{"value":"herbs","label":"herbs,Herbs___"},{"value":"Gramineae","label":"Gramineae"},{"value":"AustralocyprisRobusta","label":"AustralocyprisRobusta"},{"value":"Coscinodiscus_radiatus","label":"Coscinodiscus_radiatus"},{"value":"Cyperaceae","label":"Cyperaceae"},{"value":"Npachderma","label":"Npachderma"},{"value":"pachysin","label":"pachysin,percent_pachysin"},{"value":"Pinus","label":"Pinus"},{"value":"Pseudtsuga","label":"Pseudtsuga"},{"value":"Stephanopyxis","label":"Stephanopyxis"},{"value":"Tsuga_heterophylla","label":"Tsuga_heterophylla"},{"value":"Eukieffe","label":"Eukieffe"},{"value":"euplank","label":"euplank"},{"value":"F_curta_gp","label":"F_curta_gp,F_curta_gp_"},{"value":"Fir","label":"Fir"},{"value":"Fragilariopsis","label":"Fragilariopsis"},{"value":"Freshwater_planktic","label":"Freshwater_planktic"},{"value":"Foraminifera","label":"Foraminifera,G.sacculifer"},{"value":"hemidiscusCuneiformis","label":"hemidiscusCuneiformis,Hemidiscus cuneiformis,Hemidiscus_cuneiformis"},{"value":"Heterotr","label":"Heterotr"},{"value":"DiacyprisCompacta","label":"DiacyprisCompacta"},{"value":"A. octonarius","label":"A. octonarius,A_octonarius"},{"value":"A. tabularis","label":"A. tabularis,A_tabularis"},{"value":"actinocyclusOctonarius","label":"actinocyclusOctonarius,Actinocyclus_octonarius"},{"value":"actinoptychus","label":"actinoptychus,Actinoptychus,Actinoptychus spp."},{"value":"Actinoptychus_and_Paralia","label":"Actinoptychus_and_Paralia"},{"value":"Actinoptychus spp.","label":"Actinoptychus spp.,Actinoptychus_spp."},{"value":"Ailanthus","label":"Ailanthus"},{"value":"Dictyocha_acueata","label":"Dictyocha_acueata"},{"value":"Anadenanthera","label":"Anadenanthera"},{"value":"Artemesia","label":"Artemesia"},{"value":"ArtemisiaCount","label":"ArtemisiaCount"},{"value":"Az. tabularis","label":"Az. tabularis"},{"value":"Azpeitia nodulifer","label":"Azpeitia nodulifer"},{"value":"BorealShrubs","label":"BorealShrubs"},{"value":"BorealTrees","label":"BorealTrees"},{"value":"hygrophytes","label":"hygrophytes,Hygrophytes"},{"value":"CIA","label":"CIA,chemical index of alteration"},{"value":"Chaetoceros spores","label":"Chaetoceros spores"},{"value":"Chaetoceros_spores","label":"Chaetoceros_spores"},{"value":"Chaoboru","label":"Chaoboru"},{"value":"Chenopodiacaeae","label":"Chenopodiacaeae"},{"value":"Chenopodiaceae","label":"Chenopodiaceae"},{"value":"chironomid","label":"chironomid,Chironom"},{"value":"Chironomid_C","label":"Chironomid_C"},{"value":"rejected","label":"rejected"},{"value":"Compositeae","label":"Compositeae"},{"value":"conc_dino","label":"conc_dino"},{"value":"Corynone","label":"Corynone"},{"value":"Coscinodiscus_spp.","label":"Coscinodiscus_spp.,Coscinodiscus spp."},{"value":"Coscinodiscus_large","label":"Coscinodiscus_large"},{"value":"cloudiness","label":"cloudiness,oktas_r"},{"value":"Cricotop","label":"Cricotop"},{"value":"Cyclotella_spp.","label":"Cyclotella_spp.,Cyclotella spp.,Cyclotella_spp"},{"value":"D_aff_D_aculeata","label":"D_aff_D_aculeata"},{"value":"D_aspinosa","label":"D_aspinosa"},{"value":"D_calida","label":"D_calida"},{"value":"D_calida_ampliata","label":"D_calida_ampliata"},{"value":"D_perlaevis","label":"D_perlaevis"},{"value":"D_stapedia","label":"D_stapedia"},{"value":"Dc_stapedia_aspinosa","label":"Dc_stapedia_aspinosa"},{"value":"Delphineis","label":"Delphineis"},{"value":"Inaperturate","label":"Inaperturate"},{"value":"pollenRatio","label":"pollenRatio,((( null ))) AC Ratio? /// pollenRatio,A/C,A/C Ratio"},{"value":"Juyanze","label":"Juyanze"},{"value":"Misodendron","label":"Misodendron"},{"value":"needsToBeSplitIntoMultiples","label":"needsToBeSplitIntoMultiples,depth-range,depthRange,depth_range"},{"value":"MytilocyprisPraenuncia","label":"MytilocyprisPraenuncia"},{"value":"N_sicula","label":"N_sicula"},{"value":"NeedleleavedWoodyCover","label":"NeedleleavedWoodyCover,NeedleavedWoodyCoverStdDev___,NeedleleavedWoodyCover___"},{"value":"Neodenticula_seminae","label":"Neodenticula_seminae"},{"value":"Nitzschia_interruptestriata","label":"Nitzschia_interruptestriata"},{"value":"O_pulchra_(med)","label":"O_pulchra_(med)"},{"value":"O_pulchra_(small)","label":"O_pulchra_(small)"},{"value":"O_pulchra_(thick)","label":"O_pulchra_(thick)"},{"value":"Octactis_pulchra_(lrg)","label":"Octactis_pulchra_(lrg)"},{"value":"Oliverid","label":"Oliverid"},{"value":"Other_planktic","label":"Other_planktic"},{"value":"P. nitidum","label":"P. nitidum"},{"value":"Paraclad","label":"Paraclad"},{"value":"Paralia sulcata","label":"Paralia sulcata"},{"value":"Paralia_sucata","label":"Paralia_sucata"},{"value":"Pentaneu","label":"Pentaneu"},{"value":"Percent_fine_fraction","label":"Percent_fine_fraction"},{"value":"PiceaCount","label":"PiceaCount"},{"value":"PiceaPinus","label":"PiceaPinus"},{"value":"Pine","label":"Pine"},{"value":"Pinus/Artemesia","label":"Pinus/Artemesia,pinus/atremisia"},{"value":"PinusEdulisCount","label":"PinusEdulisCount"},{"value":"PinusTotalCount","label":"PinusTotalCount"},{"value":"aquaticPollen","label":"aquaticPollen,Pollen aquat"},{"value":"Pollen_conc","label":"Pollen_conc,Pollen conc"},{"value":"Pollen_fern_spores","label":"Pollen_fern_spores,Pollen fern spores"},{"value":"Pollen_herbs","label":"Pollen_herbs,Pollen herbs"},{"value":"Pollen_indet","label":"Pollen_indet,Pollen indet"},{"value":"pollen_sequence","label":"pollen_sequence,pollen sequence"},{"value":"Pollen_sequence","label":"Pollen_sequence,Pollen sequence"},{"value":"Pollen_trees+shrubs","label":"Pollen_trees+shrubs,Pollen trees+shrubs"},{"value":"pollen_count","label":"pollen_count"},{"value":"pollen_grains/gram","label":"pollen_grains/gram"},{"value":"Pollen_spores_Total","label":"Pollen_spores_Total,Pollen_spores_Total___"},{"value":"PollenConc","label":"PollenConc"},{"value":"pollenSum","label":"pollenSum"},{"value":"Procladi","label":"Procladi"},{"value":"Psectroc","label":"Psectroc"},{"value":"Pseudodi","label":"Pseudodi"},{"value":"Pseudoeunotia_doliolus","label":"Pseudoeunotia_doliolus"},{"value":"quercus_juniperus_cercocarpus","label":"quercus_juniperus_cercocarpus"},{"value":"ReticyprisHerbstii","label":"ReticyprisHerbstii"},{"value":"ReticyprisSp","label":"ReticyprisSp"},{"value":"Rhizosolenia","label":"Rhizosolenia"},{"value":"Score_Steppe","label":"Score_Steppe,Score_Steppe_"},{"value":"Score_Taiga","label":"Score_Taiga,Score_Taiga_"},{"value":"Score_Tundra","label":"Score_Tundra,Score_Tundra_"},{"value":"Sergenti","label":"Sergenti"},{"value":"Stephanopyxis_spp.","label":"Stephanopyxis_spp.,Stephanopyxis spp."},{"value":"Stictoch","label":"Stictoch"},{"value":"T_mertensianna","label":"T_mertensianna"},{"value":"T_oestrupii","label":"T_oestrupii"},{"value":"T_pacifica","label":"T_pacifica"},{"value":"T_spp","label":"T_spp"},{"value":"Tanytars","label":"Tanytars"},{"value":"Thalassiosira spp.","label":"Thalassiosira spp."},{"value":"Thalassiosira_excentrica","label":"Thalassiosira_excentrica"},{"value":"Thalassiothrix_longissima","label":"Thalassiothrix_longissima"},{"value":"Thronshrub","label":"Thronshrub"},{"value":"tycho","label":"tycho"},{"value":"V humeralis","label":"V humeralis"},{"value":"Zalutsch","label":"Zalutsch"},{"value":"Ephedra","label":"Ephedra"},{"value":"Poaceae","label":"Poaceae"}]

var proxylist = [{"value":"10Be","label":"10Be"},{"value":"accumulation rate","label":"accumulation rate,sed accumulation"},{"value":"ACL","label":"ACL,average chain length"},{"value":"Al2O3","label":"Al2O3,aluminum oxide"},{"value":"Al/Ca","label":"Al/Ca,aluminum/calcium"},{"value":"Al/Si","label":"Al/Si,AlSi"},{"value":"alkenone","label":"alkenone,Alkenone"},{"value":"n-alkane","label":"n-alkane"},{"value":"amoeba","label":"amoeba,testate amoeba"},{"value":"Ba/Al","label":"Ba/Al,Barium/Aluminum"},{"value":"Ba/Ca","label":"Ba/Ca,barium/calcium,BaCa"},{"value":"Ba/Sr","label":"Ba/Sr"},{"value":"biomarker","label":"biomarker,C15 fatty alcohols,C37.concentration"},{"value":"BIT","label":"BIT,branched and isoprenoid tetraether index,BITindex"},{"value":"borehole","label":"borehole"},{"value":"BSi","label":"BSi,biogenic silica"},{"value":"bubble frequency","label":"bubble frequency"},{"value":"bulk density","label":"bulk density,gamma"},{"value":"bulk sediment","label":"bulk sediment,dry sediment,BulkSed"},{"value":"C/N","label":"C/N,carbon/nitrogen"},{"value":"Ca","label":"Ca,calcium"},{"value":"Ca/K","label":"Ca/K,calcium/potassium"},{"value":"Ca/Ti","label":"Ca/Ti,calcium/titanium"},{"value":"Ca/Mg","label":"Ca/Mg"},{"value":"CaCO3","label":"CaCO3,calcium carbonate"},{"value":"calcification rate","label":"calcification rate,calcification"},{"value":"calcite","label":"calcite"},{"value":"carbonate","label":"carbonate,authigenic carbonate,Carbonate content"},{"value":"CBT","label":"CBT,cyclization index of branched tetraethers"},{"value":"cellulose","label":"cellulose"},{"value":"charcoal","label":"charcoal"},{"value":"chironomid","label":"chironomid,midge,Chironomid"},{"value":"chlorophyll","label":"chlorophyll"},{"value":"chrysophyte assemblage","label":"chrysophyte assemblage,chrysophyte"},{"value":"cladoceran","label":"cladoceran,Cladocera"},{"value":"coccolithophore","label":"coccolithophore,coccolith"},{"value":"d13C","label":"d13C,delta 13C,d13Cwax"},{"value":"d15N","label":"d15N,delta 15N"},{"value":"d15N/d40Ar","label":"d15N/d40Ar,15N/40Ar fractionation,d15Nd40Ar"},{"value":"d18O","label":"d18O,delta 18O,cellulose d18O,delta18O,foram d18O"},{"value":"dD","label":"dD,delta 2H,d2H,dDwax,leaf wax,LeafWax,leafWax"},{"value":"deuterium excess","label":"deuterium excess,deterium excess,dx"},{"value":"diatom","label":"diatom"},{"value":"dinocyst","label":"dinocyst,dinoflagellate,dynocist MAT"},{"value":"dolomite","label":"dolomite,CaMg(CO3)2"},{"value":"dry bulk density","label":"dry bulk density,DBD"},{"value":"Eu/Zr","label":"Eu/Zr"},{"value":"Fe","label":"Fe,iron"},{"value":"Fe/Al","label":"Fe/Al,iron/aluminum"},{"value":"Fe/Ca","label":"Fe/Ca,FeCa"},{"value":"Fe/K","label":"Fe/K,iron/potassium"},{"value":"Fe/Mn","label":"Fe/Mn,iron/manganese"},{"value":"foraminifera","label":"foraminifera,foraminifer,benthic foraminifers,N. dutertrei,planktonic foraminifera,planktonic foraminifera, transfer function,Uvigerina mediterranea,G. bulloides"},{"value":"GDGT","label":"GDGT,glycerol dialkyl glycerol tetraether,brGDGT"},{"value":"grain size","label":"grain size,particle size"},{"value":"HBI","label":"HBI,highly-branched isoprenoid alkene"},{"value":"historical","label":"historical,Documentary,historic"},{"value":"humification","label":"humification,humification index"},{"value":"ice accumulation","label":"ice accumulation,Ice Accumulation"},{"value":"ice melt","label":"ice melt,melt,melt layer"},{"value":"inorganic carbon","label":"inorganic carbon,TIC"},{"value":"IP25","label":"IP25,ice proxy with 25 carbon atoms"},{"value":"K/Al","label":"K/Al,potassium/aluminum"},{"value":"lake level","label":"lake level,Lake stratigraphy and radiocarbon dating of macrofossils,lakeLevel,lakelevel,LakeStatus"},{"value":"latewood cellulose","label":"latewood cellulose,late-wood cellulose"},{"value":"LDI","label":"LDI,long-chain diol index,long chain diol"},{"value":"macrofossils","label":"macrofossils,plant macrofossils"},{"value":"magnetic","label":"magnetic,ARM/IRM,IRM"},{"value":"magnetic susceptibility","label":"magnetic susceptibility,Magnetic Susceptibility,MS"},{"value":"mass accumulation rate","label":"mass accumulation rate,mass per area per time unit,MAR"},{"value":"maximum latewood density","label":"maximum latewood density,latewood density,delta Density,MXD"},{"value":"Mg","label":"Mg,magnesium"},{"value":"Mg/Ca","label":"Mg/Ca,magnesium/calcium,foram Mg/Ca,Foram Mg/Ca,MgCa"},{"value":"Mn/Fe","label":"Mn/Fe,manganese/iron,MnFe"},{"value":"Mn/Ti","label":"Mn/Ti,manganese/titanium,MnTi"},{"value":"multiproxy","label":"multiproxy,multiple proxies,Ti,Ca,K,pore ice d2H and d18O,hybrid,Hybrid Grain Size,hybrid-ice,hybrid-lake"},{"value":"deleteMe","label":"deleteMe,PCA,((( calcium carbonate ))) accumulation /// null,3-OH-Fatty Acids,Age,CAS,coral,element,Element Ratio,ice,isotope,isotope diffusion,MG0,middle-wood cellulose,mineral,mineralogy,percent,sediment,Sediment,TDS,trace element / CA,TraceElement, ,u Cluster 2"},{"value":"CIA","label":"CIA,Chemical Index of Alteration"},{"value":"ostracod","label":"ostracod"},{"value":"P-aqueous","label":"P-aqueous,Paq"},{"value":"peat ash","label":"peat ash"},{"value":"pH","label":"pH"},{"value":"pollen","label":"pollen,aquatic palynomorphs"},{"value":"radiolaria","label":"radiolaria,radiolarian"},{"value":"Rb","label":"Rb,rubidium"},{"value":"Rb/Sr","label":"Rb/Sr"},{"value":"reflectance","label":"reflectance"},{"value":"ring width","label":"ring width,TRW"},{"value":"RIAN","label":"RIAN"},{"value":"sedimentation rate","label":"sedimentation rate,Sedimentation rate"},{"value":"Sr","label":"Sr,strontium"},{"value":"Sr/Ca","label":"Sr/Ca,strontium/calcium,Ca/Sr,Coral Sr/Ca,SrCa"},{"value":"stratigraphy","label":"stratigraphy,Minerogenic layers,Plant detrital layers,Stratigraphy"},{"value":"sulfur","label":"sulfur,S"},{"value":"TEX86","label":"TEX86,tetraether index of 86 carbon atoms"},{"value":"Ti","label":"Ti,titanium"},{"value":"Ti/Al","label":"Ti/Al,titanium/aluminum"},{"value":"Ti/Ca","label":"Ti/Ca,titanium/calcium,ln(ti/ca),Ti/CA,TiCa"},{"value":"TOC","label":"TOC,organic carbon,LOI"},{"value":"total nitrogen","label":"total nitrogen,TN"},{"value":"varve thickness","label":"varve thickness,varve,Varve,varve property,varves"}]

var compilationNames = Object.keys(compilationJson);

function split( val ) {
return val.split( /,\s*/ );
}

var latestCompilations = {};
(async () => {
  latestCompilations = await transformToLabelValueArray();
  console.log(latestCompilations);
})();

function loadVersions(compilation){
	//console.log("compilationJson[compilation].versions: " + compilationJson[compilation].versions)
	return compilationJson[compilation].versions
}

 $(function() {
function split( val ) {
return val.split( /,\s*/ );
}
function extractLast( term ) {
return split( term ).pop();
}
	
$( "#archivedCompilationIn" )
 // don't navigate away from the field on tab when selecting an item
.bind( "keydown", function( event ) {
if ( event.keyCode === $.ui.keyCode.TAB &&
$( this ).autocomplete( "instance" ).menu.active ) {
event.preventDefault();
}
})
.autocomplete({
minLength: 0,
source: function( request, response ) {
// delegate back to autocomplete, but extract the last term
response( $.ui.autocomplete.filter(
compilationNames, extractLast( request.term ) ) );
},

//    source:projects,    
focus: function() {
// prevent value inserted on focus
return false;
},
select: function( event, ui ) {
return this.value;
}
});
});

 $(function() {
function split( val ) {
return val.split( /,\s*/ );
}
function extractLast( term ) {
return split( term ).pop();
}
	
$( "#archivedCompilationVersionIn" )
 // don't navigate away from the field on tab when selecting an item
.bind( "keydown", function( event ) {
if ( event.keyCode === $.ui.keyCode.TAB &&
$( this ).autocomplete( "instance" ).menu.active ) {
event.preventDefault();
}
})
.autocomplete({
minLength: 0,
source: function( request, response ) {
// delegate back to autocomplete, but extract the last term
response( $.ui.autocomplete.filter(
loadVersions(document.getElementById("archivedCompilationIn").value), extractLast( request.term ) ) );
},

//    source:projects,    
focus: function() {
// prevent value inserted on focus
return false;
},
select: function( event, ui ) {
return this.value;
}
});
});

$(function() {
    function split(val) {
        return val.split(/,\s*/);
    }
    function extractLast(term) {
        return split(term).pop();
    }

    function setupAutocomplete(selector, dataSource) {
        if ($(selector).length === 0) return;
        var widget = $(selector)
            .on("keydown", function(event) {
                if (
                    event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete("instance") &&
                    $(this).autocomplete("instance").menu.active
                ) {
                    event.preventDefault();
                }
            })
            .autocomplete({
                minLength: 0, // important for empty string after comma
                source: function(request, response) {
                    // Always autocomplete the last term
                    response($.ui.autocomplete.filter(dataSource, extractLast(request.term)));
                },
                focus: function() { return false; }, // prevent value inserted on focus
                select: function(event, ui) {
                    var terms = split(this.value);
                    terms.pop(); // remove the current input
                    terms.push(ui.item.value); // add the selected item
                    terms.push(""); // add placeholder to get comma-space at end
                    this.value = terms.join(", ");
                    return false;
                }
            });
        // Render canonical LiPD term in bold, synonyms in light gray
        widget.data("ui-autocomplete")._renderItem = function(ul, item) {
            var canonical = item.value;
            var synonyms = item.label.slice(canonical.length);
            if (synonyms.charAt(0) === ',') synonyms = synonyms.slice(1);
            var $a = $('<a>').append($('<strong>').text(canonical));
            if (synonyms) {
                $a.append($('<span>').css({ color: '#aaa', fontSize: '0.88em', marginLeft: '6px' }).text(synonyms));
            }
            return $('<li>').append($a).appendTo(ul);
        };
    }

    // Multi-select fields — rendered as chip/tag inputs.
    // Pass lazy getters for any source that is populated asynchronously (so the autocomplete
    // picks up the latest value at lookup time, not at setup time).
    chipifyAutocomplete("#proxy", function() { return proxylist; });
    chipifyAutocomplete("#variableName", function() { return variablelist; });
    chipifyAutocomplete("#interpVar", function() { return interpVarList; });
    chipifyAutocomplete("#archiveTypeIn", function() { return archivelist; });
    chipifyAutocomplete("#countryIn", function() { return countrylist; });
    chipifyAutocomplete("#continentIn", function() { return continentlist; });
    chipifyAutocomplete("#compilationIn", function() { return latestCompilations; });
    chipifyAutocomplete("#seasonality1", function() { return seasonalitylist; });

});

// After all chipify conversions have run, re-apply PAGE_CONFIG defaults onto the now-hidden
// inputs and trigger a re-render. This is a safety net for cases where PAGE_CONFIG's inline
// script set values on the pre-chipify <input> and those values somehow didn't carry through.
$(function() {
    var cfg = window.PAGE_CONFIG;
    if (!cfg) return;
    function apply(id, value) {
        if (value == null || value === '') return;
        var el = document.getElementById(id);
        if (!el) return;
        if (!el.value) el.value = value;
        $(el).trigger('chip:sync');
    }
    apply('compilationIn', cfg.compilationFilter);
    apply('interpVar', cfg.interpVarDefault);
});

/**
 * Runtime DOM rewrite: replace a plain <input> with a chip-style multi-select.
 * The original id and name are preserved on a new hidden input so existing readers
 * (`document.getElementById(id).value`) keep working without changes.
 */
function chipifyAutocomplete(selector, dataSource) {
    var original = document.querySelector(selector);
    if (!original) { console.warn('[chipify] no element found for', selector); return; }

    var id = original.id;

    // If the input is already a hidden mirror (server may have served pre-chipified HTML),
    // just wire up the existing chip container/typing input instead of re-creating them.
    if (original.type === 'hidden') {
        var existingWrapper = document.getElementById(id + 'ChipContainer');
        var existingTyping = document.getElementById(id + 'Typing');
        if (existingWrapper && existingTyping) {
            console.log('[chipify] wiring pre-existing chip widget for', selector, 'value:', JSON.stringify(original.value));
            setupChipAutocomplete('#' + id, '#' + existingTyping.id, '#' + existingWrapper.id, dataSource);
        } else {
            console.warn('[chipify] hidden input with no chip container:', selector);
        }
        return;
    }
    console.log('[chipify]', selector, 'initial value:', JSON.stringify(original.value));

    var parent = original.parentNode;

    var wrapper = document.createElement('div');
    wrapper.className = 'chip-input';
    wrapper.id = id + 'ChipContainer';
    if (original.style.width) wrapper.style.width = original.style.width;

    var typing = document.createElement('input');
    typing.type = 'text';
    typing.id = id + 'Typing';
    typing.className = 'chip-input-typing';
    typing.setAttribute('autocomplete', 'off');
    typing.placeholder = 'Begin typing for suggestions';
    wrapper.appendChild(typing);

    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = id;
    if (original.name) hidden.name = original.name;
    hidden.value = original.value || '';

    parent.insertBefore(wrapper, original);
    parent.insertBefore(hidden, wrapper.nextSibling);
    parent.removeChild(original);

    setupChipAutocomplete('#' + id, '#' + typing.id, '#' + wrapper.id, dataSource);
}

/**
 * Chip-style multi-select autocomplete.
 *   hiddenSelector:    the <input type="hidden"> holding the canonical comma-joined value
 *   typingSelector:    the visible <input type="text"> inside the chip container
 *   containerSelector: the .chip-input wrapper
 *   dataSource:        jQuery-UI autocomplete source (array of strings or {label,value})
 *
 * Keeps the hidden input's value as a plain comma-joined list so existing readers
 * (params(), queryParams) work unchanged. Chips render left-to-right before the typing input.
 */
function setupChipAutocomplete(hiddenSelector, typingSelector, containerSelector, dataSource) {
    var $hidden = $(hiddenSelector);
    var $typing = $(typingSelector);
    var $container = $(containerSelector);
    if ($hidden.length === 0 || $typing.length === 0 || $container.length === 0) return;

    function readChips() {
        var v = $hidden.val() || "";
        return v.split(",").map(function(s){ return s.trim(); }).filter(Boolean);
    }
    function commit(chips) {
        var seen = {};
        chips = chips.filter(function(c){ if (seen[c]) return false; seen[c] = 1; return true; });
        $hidden.val(chips.join(","));
        render(chips);
        $hidden.trigger("change");
    }
    function render(chips) {
        $container.find(".chip").remove();
        chips.forEach(function(chip) {
            var $chip = $('<span class="chip"></span>').text(chip);
            var $x = $('<button type="button" class="chip-x" aria-label="Remove">&times;</button>');
            $x.on("click", function(e) {
                e.preventDefault();
                var cur = readChips();
                var idx = cur.indexOf(chip);
                if (idx >= 0) {
                    cur.splice(idx, 1);
                    commit(cur);
                }
                $typing.focus();
            });
            $chip.append($x);
            $typing.before($chip);
        });
    }
    function addChip(value) {
        value = (value || "").trim();
        if (!value) return;
        var cur = readChips();
        if (cur.indexOf(value) !== -1) return;
        cur.push(value);
        commit(cur);
    }
    function removeLastChip() {
        var cur = readChips();
        if (cur.length === 0) return;
        cur.pop();
        commit(cur);
    }

    $container.on("mousedown", function(e) {
        // Clicking empty space inside the wrapper focuses the typing input
        if (e.target === $container[0]) {
            e.preventDefault();
            $typing.focus();
        }
    });

    $typing
        .on("keydown", function(event) {
            if (event.keyCode === 8 && !$(this).val()) {
                event.preventDefault();
                removeLastChip();
                return;
            }
            if (event.keyCode === 13) {
                var inst = $(this).autocomplete("instance");
                if (inst && inst.menu.active) {
                    // Let the autocomplete select callback commit the highlighted suggestion.
                    return;
                }
                event.preventDefault();
                var val = $(this).val();
                if (val) { addChip(val); $(this).val(""); }
                return;
            }
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance") &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        })
        .on("blur", function() {
            var val = $(this).val();
            if (val) { addChip(val); $(this).val(""); }
        })
        .autocomplete({
            minLength: 0,
            source: function(request, response) {
                var ds = (typeof dataSource === 'function') ? dataSource() : dataSource;
                if (!ds || (!Array.isArray(ds) && typeof ds.length !== 'number')) ds = [];
                response($.ui.autocomplete.filter(ds, request.term || ""));
            },
            focus: function() { return false; },
            select: function(event, ui) {
                addChip(ui.item.value);
                $(this).val("");
                return false;
            }
        });

    var widget = $typing.data("ui-autocomplete");
    if (widget) {
        widget._renderItem = function(ul, item) {
            var canonical = item.value;
            var synonyms = (item.label || "").slice(canonical.length);
            if (synonyms.charAt(0) === ',') synonyms = synonyms.slice(1);
            var $a = $('<a>').append($('<strong>').text(canonical));
            if (synonyms) {
                $a.append($('<span>').css({ color: '#aaa', fontSize: '0.88em', marginLeft: '6px' }).text(synonyms));
            }
            return $('<li>').append($a).appendTo(ul);
        };
    }

    // Re-render if some other code sets the hidden value programmatically (e.g. PAGE_CONFIG defaults).
    $hidden.on("chip:sync", function() { render(readChips()); });

    // Initial paint (picks up any default already assigned to the hidden input)
    render(readChips());
}
function hideForm(){
	if (document.getElementById("archivedCompilation").checked){
		document.getElementById("queryForm").style.display = "none";
		document.getElementById("map").style.display = "none";
		document.getElementById("mapUpdateButton").style.display = "none";
		document.getElementById("InstructionBox").style.display = "none";
		document.getElementById("proceedButton").style.display = "none";
		document.getElementById("datasetCount").style.display = "none";
		document.getElementById("archivedCompilationGroup").style.display = "block";
		document.getElementById("archivedCompButton").style.display = "block";
		document.getElementById("compilationForm").style.display = "block";
	} else {
		document.getElementById("queryForm").style.display = "block";
		document.getElementById("map").style.display = "block";
		document.getElementById("mapUpdateButton").style.display = "block";
		document.getElementById("InstructionBox").style.display = "block";
		document.getElementById("proceedButton").style.display = "block";
		document.getElementById("datasetCount").style.display = "block";
		document.getElementById("archivedCompilationGroup").style.display = "none";
		document.getElementById("archivedCompButton").style.display = "none";
		document.getElementById("compilationForm").style.display = "none";
	}
}
	
    function getQueryVariable(variable)
    {
           var query = window.location.search.substring(1);
           var vars = query.split("&");
           for (var i=0;i<vars.length;i++) {
                   var pair = vars[i].split("=");
                   if(pair[0] == variable){
                     return pair[1];}
           }
           return(false);
    }

    function popQueryVariable(){
        document.getElementById('recon').value = getQueryVariable("recon");
        document.getElementById('user').value = getQueryVariable("user");
        document.getElementById('domain').value = getQueryVariable("domain");
        document.getElementById('uniqueID').value = getQueryVariable("uniqueID");
        document.getElementById('language').value = getQueryVariable("language");
        }
async function transformToLabelValueArray() {
  
    function getLatestVersion(key) {
      const versions = Array.isArray(compilationJson[key].versions)
	? compilationJson[key].versions
	: [compilationJson[key].versions];
  
      const parsed = versions.map(v => v.split('_').map(Number));
      parsed.sort((a, b) => {
	for (let i = 0; i < 3; i++) {
	  if (a[i] !== b[i]) return b[i] - a[i];
	}
	return 0;
      });
  
      return parsed[0].join('_');
    }
  
    return Object.keys(compilationJson).map(key => {
      const latest = getLatestVersion(key);
      return {
	value: `${key}-${latest}`,
	label: key
      };
    });
  }
function chooseColor(archiveType, interpVar, proxy){
    // Check if we're in proxy legend mode (use window.legendMode for cross-script access)
    if (typeof window.legendMode !== 'undefined' && window.legendMode === 'proxy') {
        var proxyValue = proxy;
        if (Array.isArray(proxy)) {
            proxyValue = proxy[0];
        }
        if (Array.isArray(proxyValue)) {
            proxyValue = proxyValue[0];
        }
        proxyValue = proxyValue ? proxyValue.toString().trim() : '';

        if (proxyValue && typeof proxyColorPal[proxyValue] !== 'undefined') {
            return proxyColorPal[proxyValue];
        } else {
            return proxyColorPal["*Other*"] || "#808080";
        }
    } else if (typeof window.legendMode !== 'undefined' && window.legendMode === 'interpVar') {
        // Convert interpVar from array to string (same as archiveType handling)
        interpVar = interpVar ? interpVar.toString() : '';
        console.log('chooseColor in interpVar mode, interpVar:', interpVar, 'in top15:', top15InterpVars.indexOf(interpVar) !== -1);
        // Map interpVar to top 15 or "*Other*"
        if (interpVar && top15InterpVars.indexOf(interpVar) !== -1) {
            var color1 = interpVarColorPal[interpVar];
            return color1 || "#808080";
        } else {
            return interpVarColorPal["*Other*"] || "#808080";
        }
    } else {
        // Default: archiveType mode
        archiveType = archiveType.toString();
        var color1 = colorPal[archiveType]
        if (typeof color1 !== 'undefined'){
            return color1
        } else {
            return "black"
        }
    }
}
function chooseShape(archiveType, interpVar, proxy){
    // Check if we're in proxy legend mode (use window.legendMode for cross-script access)
    if (typeof window.legendMode !== 'undefined' && window.legendMode === 'proxy') {
        var proxyValue = proxy;
        if (Array.isArray(proxy)) {
            proxyValue = proxy[0];
        }
        if (Array.isArray(proxyValue)) {
            proxyValue = proxyValue[0];
        }
        proxyValue = proxyValue ? proxyValue.toString().trim() : '';

        if (proxyValue && typeof proxyShapePal[proxyValue] !== 'undefined') {
            return proxyShapePal[proxyValue];
        } else {
            return proxyShapePal["*Other*"] || "diamond";
        }
    } else if (typeof window.legendMode !== 'undefined' && window.legendMode === 'interpVar') {
        // Convert interpVar from array to string (same as archiveType handling)
        interpVar = interpVar ? interpVar.toString() : '';
        // Map interpVar to top 15 or "*Other*"
        if (interpVar && top15InterpVars.indexOf(interpVar) !== -1) {
            var shape1 = interpVarShapePal[interpVar];
            return shape1 || "diamond";
        } else {
            return interpVarShapePal["*Other*"] || "diamond";
        }
    } else {
        // Default: archiveType mode
        archiveType = archiveType.toString();
        var shape1 = shapePal[archiveType]
        if (typeof shape1 !== 'undefined'){
            return shape1
        } else {
            return "diamond"
        }
    }
}
function loadLatLon (a1){
    console.log("loadLatLon received " + a1.length + " datasets");
    var x1 = a1.filter((arr, index, self) =>
    index === self.findIndex((t) => (t.geo_latitude === arr.geo_latitude && t.geo_longitude === arr.geo_longitude)))
    console.log("After deduplication by coordinates: " + x1.length + " unique locations");
    console.log("Removed " + (a1.length - x1.length) + " datasets with duplicate coordinates");
    var geojson = {
    "name":"NewFeatureType",
    "type":"FeatureCollection",
    "features": [],
    };
var numdata = +Object.values(x1).length
var numPoints = +(numdata * 2)
    
  for (let i = 0; i < numPoints; i++) {
    if (i >= numdata){
	ii = i - numdata
    } else {
	ii = i
    }
    var ptLon = +Object.values(x1)[ii].geo_longitude
    if (i < numdata){
	lat = Object.values(x1)[ii].geo_latitude
	    lon = Object.values(x1)[ii].geo_longitude
    } else if (i >= numdata && ptLon < 0) {
	lat = Object.values(x1)[ii].geo_latitude
	    lon = (ptLon + 360)
    } else {
	lat = Object.values(x1)[ii].geo_latitude
	    lon = (ptLon - 360)
    }
    aType = Object.values(x1)[ii].archiveType
    dName = Object.values(x1)[ii].dataSetName
    dID = Object.values(x1)[ii].datasetId
    proxy1 = Object.values(x1)[ii].paleoData_proxy
    minAge = Object.values(x1)[ii].minAge
    maxAge = Object.values(x1)[ii].maxAge
    interpVars = Object.values(x1)[ii].interp_Vars
    geojson.features.push({ "type": "Feature","geometry": {"type": "Point","coordinates": []},"properties": {"archiveType": [], "dataSetName": [], "paleoData_proxy": [], "minAge": [], "maxAge": [], "datasetId": [], "interp_Vars": []} });
    geojson.features[i].geometry.coordinates.push(lon,lat);
    geojson.features[i].properties.archiveType.push(aType);
    geojson.features[i].properties.dataSetName.push(dName);
    geojson.features[i].properties.datasetId.push(dID);
    geojson.features[i].properties.paleoData_proxy.push(proxy1);
    geojson.features[i].properties.minAge.push(minAge);
    geojson.features[i].properties.maxAge.push(maxAge);
    geojson.features[i].properties.interp_Vars.push(interpVars);
  }

  return(geojson)
}

function rmBlanks(val){
    if (val.length > 0) {
	val = split(val)
	val = val.filter(Boolean)
	    val = val.join( "," );
    }
return val;
}
        
function qString(val1,name1){

var x1 = rmBlanks(val1)

if (x1.length == 0){
    return '';
} else {
    return name1 + '=' + x1;
}

}
arrayGrep = function (arr1, arr2, selectedString){
var indices = [];
for (var i=0; i < arr1.length; i++){
    if (arr1.at(i).includes(selectedString)){
    indices.push(i)
  }
}
var arr3 = indices.map(i => arr2[i]);
arr3 = arr3.filter(n => n)
arr3 = arr3.sort()
return arr3.at(-1)
}
getAllMonths = function(startSpan,endSpan){
    var monthText = seasonality2.map(function(d) { return d.label; });
    var allMonths = [];
  startSpan=startSpan-1
  //var spanMax = (endSpan-startSpan)+1
  for (var i=startSpan; i < endSpan; i++){
    var startmonth = monthText[i]
    var monthSpan = endSpan - i
    for (var ii=0; ii < monthSpan; ii++){
      var endMonth = monthText[(ii+i)]
      if (startmonth==endMonth){
	allMonths.push(startmonth)
      } else {
	allMonths.push(startmonth + "-" + endMonth)
      }
    }
  }
  allMonths = allMonths.join(",")
  return(allMonths)
}
        function params(useCoords=false){
            var x1 = rmBlanks(document.getElementById("archiveTypeIn").value)
            var x2 = rmBlanks(document.getElementById("variableName").value)

            // Build array of non-empty query parts
            var queryParts = [];

            var part;
            part = qString(document.getElementById("archiveTypeIn").value,document.getElementById("archiveTypeIn").name,false);
            if (part) queryParts.push(part);

            part = qString(document.getElementById("variableName").value,document.getElementById("variableName").name,false);
            if (part) queryParts.push(part);

            part = qString(document.getElementById("proxy").value,document.getElementById("proxy").name,false);
            if (part) queryParts.push(part);

            var interpVarEl = document.getElementById("interpVar");
            if (interpVarEl) {
                part = qString(interpVarEl.value, interpVarEl.name, false);
                if (part) queryParts.push(part);
            }

            part = qString(document.getElementById("countryIn").value,document.getElementById("countryIn").name,false);
            if (part) queryParts.push(part);

            part = qString(document.getElementById("continentIn").value,document.getElementById("continentIn").name,false);
            if (part) queryParts.push(part);

            part = qString(document.getElementById("compilationIn").value,document.getElementById("compilationIn").name,true);
            if (part) queryParts.push(part);

            if (!JSON.parse(filters1['seasonality'])){
                part = qString(document.getElementById("seasonality1").value,document.getElementById("seasonality1").name,false);
                if (part) queryParts.push(part);
            }

            if (useCoords===true){
                if (JSON.parse(filters1['coords'])){
                    queryParts.push('geo_latitude < ' + document.getElementById("lat_max").value);
                    queryParts.push('geo_latitude > ' + document.getElementById("lat_min").value);
                    queryParts.push('geo_longitude < ' + document.getElementById("lon_max").value);
                    queryParts.push('geo_longitude > ' + document.getElementById("lon_min").value);
                }
            }
            // Independent temporal-extent filters. Express's querystring parser
            // treats '=' as the key/value separator, so encode '>=' as '> N-1'
            // and '<=' as '< N+1'.
            if (filters1['extendBack'] && JSON.parse(filters1['extendBack'])){
                // Record's oldest data point must be at least extendBack yr BP.
                var extendBackVal = parseFloat(document.getElementById("extendBackInput").value);
                if (!isNaN(extendBackVal)) queryParts.push('maxAge > ' + (extendBackVal - 1));
            }
            if (filters1['extendForward'] && JSON.parse(filters1['extendForward'])){
                // Record's youngest data point must be no older than extendForward yr BP.
                var extendForwardVal = parseFloat(document.getElementById("extendForwardInput").value);
                if (!isNaN(extendForwardVal)) queryParts.push('minAge < ' + (extendForwardVal + 1));
            }
            if (JSON.parse(filters1['resolution'])){
                var subannualEl = document.getElementById('subannualOnly');
                if (subannualEl && subannualEl.checked) {
                    queryParts.push('medianResolution < 1');
                } else {
                    // "<= N" encoded as "< N+1" to avoid '=' in the URL key.
                    var resVal = parseFloat(document.getElementById("resolutionInput").value);
                    if (!isNaN(resVal)) queryParts.push('medianResolution < ' + (resVal + 1));
                }
            }
            if (filters1['minLength'] && JSON.parse(filters1['minLength'])){
                // Avoid '=' in the expression: the server's querystring parser treats '='
                // as the key/value separator. ">= N" is equivalent to "> N-1" for this filter.
                var minLenVal = parseFloat(document.getElementById("minLengthInput").value);
                if (!isNaN(minLenVal)) {
                    queryParts.push('maxAge - minAge > ' + (minLenVal - 1));
                }
            }
            if (JSON.parse(filters1['seasonality'])){
                queryParts.push(document.getElementById("seasonality1").name + "=" + rmBlanks(document.getElementById("seasonality1").value + "," + getAllMonths(document.getElementById("months_range_fromSlider").value,document.getElementById("months_range_toSlider").value)));
            }

            // Join with & and prepend with ?
            var qstring = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
            console.log("qstring from params(): " + qstring)
            return qstring;
        };
        sendQuery = function(){
            var param1 = params(useCoords=false)
            var xhr0 = new XMLHttpRequest();
                xhr0.timeout = 2000;
                xhr0.onreadystatechange = function(e){
                    //console.log(this);
                    if (xhr0.readyState === 4){
                        if (xhr0.status === 200){
                    const promise1 = new Promise((resolve, reject) => {
                        console.log("query: " + param1)
                        prevResp = updateRes(JSON.parse(xhr0.response));
                        console.log("Database returned " + prevResp.length + " datasets");

                        resolve();
                    });
                    promise1.then(() => {
                      updatePoints(prevResp)
                      console.log("After updatePoints, inRectCount = " + inRectCount);
                      xhr0 = null;
                      // Expected output: "Success!"
                    });
                        } else {
                    const promise1 = new Promise((resolve, reject) => {
                        console.log("XHR didn't work: " + xhr0.status);
                        resolve();
                    });
                    
                    promise1.then(() => {
                      xhr0 = null;
                      // Expected output: "Success!"
                    });
                    
                            
                        }
                    }
                }
                xhr0.ontimeout = function (){
                    console.error("request timedout: ", xhr0);
                }
                xhr0.open("get", "/data/" + param1, /*async*/ true);
                // xhr.responseType = "text";
                xhr0.send();
            }
        

        
        postTSids = function(Body){
                var xhr7 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    xhr7.onreadystatechange = (e) => {
                    if (xhr7.readyState !== 4) {
                        return;
                    }
                    if (xhr7.status === 200){
                        //console.log("time series: ");
                        //console.log(xhr.responseText);
                        resolve(xhr7.responseText);
                    } else {
                        var resp1 = "XHR didn't work: " + xhr7.status;
                        console.log(resp1);
                        resolve();
                    }
                };
                xhr7.open("post", "/posttsids/", /*async*/ true);
                xhr7.setRequestHeader("Content-type", "application/json");
                xhr7.send(Body);
                });
        }
            
        getTSIDs = function(){

                var xhr2 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    if (document.getElementById("archivedCompilation").checked) {
                        resolve();
                    } else {
                            xhr2.onreadystatechange = (e) => {
                            if (xhr2.readyState !== 4) {
                                return;
                            }
                            if (xhr2.status === 200){
                                console.log("TSIDs response received:");
                                var tsidArray = JSON.parse(xhr2.responseText);
                                console.log("Number of TSIDs returned: " + tsidArray.length);
                                console.log(xhr2.responseText);
                                resolve(xhr2.responseText);
                            } else {
                                var resp1 = "XHR didn't work: " + xhr2.status;
                                console.log(resp1);
                                resolve();
                            }
                        };
                        var tsURL = "/data/TS" + params(useCoords=true);
                        console.log("getTSIDs requesting URL: " + tsURL);
                        xhr2.open("get", tsURL, /*async*/ true);
                        xhr2.send();
                    }
                    });
        }
        
        retTimeSeries = function(TSIDs){
                var xhr3 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    xhr3.onreadystatechange = (e) => {
                    if (xhr3.readyState !== 4) {
                        return;
                    }
                    if (xhr3.status === 200){
                        //console.log("time series: ");
                        //console.log(xhr.responseText);
                        resolve(xhr3.responseText);
                    } else {
                        //var resp1 = xhr.status;
                        console.log(xhr3.status);
                        resolve(xhr3.status);
                    }
                };
                xhr3.open("post", "/sparql", /*async*/ true);
                xhr3.setRequestHeader("Content-type", "application/json");
                xhr3.send(TSIDs);
                });
        }
        
        function writeCSV(json1){
            console.log(json1)
            json1 = JSON.parse(JSON.parse(json1))
            //console.log(typeof json1)
            var keys1 = Object.keys(json1)
            /*
            if (keys1.length > 100){
                var alertText = "Preparing csv file with " + keys1.length + " records"
                alert(alertText);
            }
             */
            //console.log(keys1.length)
            var numKeys = keys1.length;
            var len1 = 0;
            var lenMax = 0;
            for (let i=0; i < numKeys; i++){
            len1 = Object.values(json1)[i].length
            if (len1 > lenMax){
            lenMax = len1
            }
            }
            //console.log(lenMax)
            
            var string1 = keys1.join(", ") + "\n"
            for (let j=0; j<lenMax; j++){
                for (var key of keys1){
                  var val1 = Object.values(json1[key])[j]
                if (typeof val1 === "undefined"){
                    string1 += ","
                } else {
                    string1 += val1 + ","
                }
              }
              string1 += "\n"
            }
            return string1
        }
        
        function downloadCurrentDocument(resp1) {
          var csvContent = encodeURI(writeCSV(resp1)),
              a = document.createElement('a'),
              e = new MouseEvent('click');
        
          a.download = 'PrestoTS.csv';
          a.href = 'data:text/csv;charset=utf-8,' + csvContent;
          a.dispatchEvent(e);
        }
        

            
        function grabCSV() {
            getTSIDs().then(reso => {
                var resoJSON = JSON.parse(reso);
                var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })
                if (IDs.length > 300){
                    var alertText = "Sorry, " + IDs.length + " is too many records to compile here"
                    alert(alertText);
                } else {
                    console.log("Total time series: " + IDs.length);
                    var tsJSON = '{"TSIDs": ' + JSON.stringify(IDs) + '}'
                    var TS1 = retTimeSeries(tsJSON).then(resp1 => {
                    downloadCurrentDocument(resp1);
                    return true
                    });
                }
            });
        }
        function getColor(d) {
            return d > 1000 ? '#800026' :
                   d > 500  ? '#BD0026' :
                   d > 200  ? '#E31A1C' :
                   d > 100  ? '#FC4E2A' :
                   d > 50   ? '#FD8D3C' :
                   d > 20   ? '#FEB24C' :
                   d > 10   ? '#FED976' :
                              '#FFEDA0';
        }
            const compileLipds = function(Body) {
            return new Promise((resolve, reject) => {
                var xhr1 = new XMLHttpRequest();
        
                xhr1.onreadystatechange = () => {
                    if (xhr1.readyState !== 4) return;
        
                    if (xhr1.status === 200) {
                        resolve(xhr1.responseText);
                    } else {
                        console.error("XHR didn't work: " + xhr1.status);
                        reject(new Error("XHR failed with status " + xhr1.status));
                    }
                };
        
                xhr1.onerror = () => {
                    reject(new Error("XHR encountered a network error"));
                };
        
                xhr1.ontimeout = () => {
                    reject(new Error("XHR request timed out"));
                };
        
                xhr1.open("POST", "/lipds", true);
                xhr1.setRequestHeader("Content-type", "application/json");
        
                xhr1.timeout = 5000; // Set a timeout (optional)
                
                xhr1.send(Body);
            });
        };
        function getLipds(loc1, lipdSource){
            return new Promise((resolve, reject) => {
                //alert(params(useCoords=true))
                getTSIDs().then(reso => {
                    if (lipdSource == 'TSIDs'){
                        if (!reso) {
                            alert('No proxy records found. Please uncheck "Use an archived compilation", update the map, then try again.');
                            return; // leave the promise pending — user stays on the page
                        }
                        var resoJSON = JSON.parse(reso);

                        // DEBUG: Check what /TS endpoint returned
                        console.log("DEBUG: First TSID record from /TS endpoint:", resoJSON[0]);
                        console.log("DEBUG: Keys in TSID record:", Object.keys(resoJSON[0]));

                        var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })

                        // Extract unique datasetIds from the TSID query result (resoJSON, not prevResp!)
                        var datasetIds = resoJSON.map(function(d) { return d['datasetId']; })
                        console.log("DEBUG: First 10 datasetIds from resoJSON:", datasetIds.slice(0, 10));
                        console.log("DEBUG: datasetIds with undefined:", datasetIds.filter(d => d === undefined).length);

                        var uniqueDatasetIds = [...new Set(datasetIds)];

                        console.log("=== TSID Collection Summary ===");
                        console.log("Total time series (TSIDs) from /TS endpoint: " + IDs.length);
                        console.log("Unique datasets from those TSIDs: " + uniqueDatasetIds.length);
                        console.log("Average TSIDs per dataset: " + (IDs.length / uniqueDatasetIds.length).toFixed(2));
                        console.log("First 5 unique datasetIds:", uniqueDatasetIds.slice(0, 5));

                        // Collect query parameters from the filter UI for lipdGenerator
                        // rmBlanks strips trailing ", " left by the autocomplete widget
                        var queryParams = {
                            archiveTypes: rmBlanks(document.getElementById('archiveTypeIn').value) || null,
                            proxy: rmBlanks(document.getElementById('proxy').value) || null,
                            variableName: rmBlanks(document.getElementById('variableName').value) || null,
                            interpVars: (document.getElementById('interpVar') ? rmBlanks(document.getElementById('interpVar').value) : null) || null,
                            country: rmBlanks(document.getElementById('countryIn').value) || null,
                            continent: rmBlanks(document.getElementById('continentIn').value) || null,
                            compilation: rmBlanks(document.getElementById('compilationIn').value) || null,
                            seasonality: rmBlanks(document.getElementById('seasonality1').value) || null
                        };
                        if (document.getElementById('coordsOn').checked) {
                            queryParams.coords = [
                                parseFloat(document.getElementById('lat_min').value),
                                parseFloat(document.getElementById('lat_max').value),
                                parseFloat(document.getElementById('lon_min').value),
                                parseFloat(document.getElementById('lon_max').value)
                            ];
                        }
                        if (filters1['extendBack'] && JSON.parse(filters1['extendBack'])) {
                            queryParams.extendBack = parseFloat(document.getElementById('extendBackInput').value);
                        }
                        if (filters1['extendForward'] && JSON.parse(filters1['extendForward'])) {
                            queryParams.extendForward = parseFloat(document.getElementById('extendForwardInput').value);
                        }
                        if (JSON.parse(filters1['resolution'])) {
                            var subannualEl2 = document.getElementById('subannualOnly');
                            if (subannualEl2 && subannualEl2.checked) {
                                queryParams.subannualOnly = true;
                            } else {
                                queryParams.resolution = parseFloat(document.getElementById('resolutionInput').value);
                            }
                        }
                        if (filters1['minLength'] && JSON.parse(filters1['minLength'])) {
                            queryParams.minRecordLength = parseFloat(document.getElementById('minLengthInput').value);
                        }
                        var postBody = {
                            TSIDs: IDs,
                            datasetIds: uniqueDatasetIds,
                            recon: document.getElementById('recon').value,
                            uniqueID: document.getElementById('uniqueID').value,
                            queryParams: queryParams
                        };
                        var tsJSON = JSON.stringify(postBody);
                        console.log("Sending POST with " + IDs.length + " TSIDs, " + uniqueDatasetIds.length + " datasetIds, queryParams:", queryParams)
                        var TSIDsArray = postBody.TSIDs;
                        var numTSids = TSIDsArray.length
                    } else {
                        // Short-circuit for lipdDownload archived path — no GitHub needed
                        const reconVal = document.getElementById('recon').value;
                        if (reconVal === 'lipdDownload') {
                            const compilation = document.getElementById('archivedCompilationIn').value;
                            const version = document.getElementById('archivedCompilationVersionIn').value;
                            resolve(`https://lipdverse.org/${compilation}/${version}/`);
                            return;
                        }
                        const archivedCompURL = 'https://lipdverse.org/' + document.getElementById('archivedCompilationIn').value + '/' + document.getElementById('archivedCompilationVersionIn').value
                        var tsJSON = '{"compilation": "' + document.getElementById('archivedCompilationIn').value + '", "version": "' + document.getElementById('archivedCompilationVersionIn').value + '", "recon": "' + document.getElementById('recon').value + '", "uniqueID":"' + document.getElementById('uniqueID').value + '"}'
                        console.log("Sending POST for archived compilation (both R and Python formats will be downloaded): ", tsJSON)
                    }
                    compileLipds(tsJSON)
                        .then(response => {
                            console.log("Success:", response);
                        if (loc1 == "download"){
                            resolve("https://www.google.com")
                        } else {
                            var queryParams = params(useCoords=true)
                            // Check if window.location.search already has query params
                            if (window.location.search) {
                                // Append with &
                                queryParams = '&' + queryParams.substring(1);
                            }
                            // If no existing query params, queryParams already starts with ?
                            queryParams = queryParams.replace(/\s/g, '');
                            // Filtered TSID queries go to data cleaning; archived compilations go directly to the editor
                            var targetBase = (lipdSource === 'TSIDs') ? '/datacleaning' : '/editor/querypath';
                            resolve(targetBase+window.location.search+queryParams)
                        }
                        })
                        .catch(error => {
                            console.error("Error:", error.message);
                        alert("Error: failed to write data selection to server. Please start over.");
                        resolve("https://paleopresto.com/custom.html");
                        });
                }).catch(error => {
                    console.error("getLipds outer error:", error);
                    alert("Error: " + error.message + "\nPlease try again.");
                });
            });
        }
function updatePoints (coords){
    inRectCount = 0;
    layerGroup.clearLayers();

    // Always read coordinate values from the form
    var latMin = +document.getElementById("lat_min").value;
    var latMax = +document.getElementById("lat_max").value;
    var lonMin = +document.getElementById("lon_min").value;
    var lonMax = +document.getElementById("lon_max").value;

    console.log('updatePoints: Form values - latMin=' + latMin + ', latMax=' + latMax + ', lonMin=' + lonMin + ', lonMax=' + lonMax);
    console.log('updatePoints: coordsOn checked =', document.getElementById("coordsOn").checked);

    if (!document.getElementById("coordsOn").checked) {
	// Reset to global bounds when unchecked
	document.getElementById("lat_min").value = -90
	document.getElementById("lat_max").value = 90
	document.getElementById("lon_min").value = -180
	document.getElementById("lon_max").value = 180
	rectCoord = {"South":-90,"West":-180,"North":90,"East":180};
    } else {
	// Use the form values when checked
	// Note: Use isNaN check instead of || because 0 is a valid coordinate
	rectCoord = {
	    "South": isNaN(latMin) ? -90 : latMin,
	    "West": isNaN(lonMin) ? -180 : lonMin,
	    "North": isNaN(latMax) ? 90 : latMax,
	    "East": isNaN(lonMax) ? 180 : lonMax
	};
    }
    console.log('updatePoints: rectCoord =', rectCoord);
 L.geoJSON([loadLatLon(coords)], {

		style : function(feature) {
		    return feature.properties && feature.properties.style;
		},

		onEachFeature: function (feature, layer) {
	    layer.bindPopup('<h1>'+feature.properties.dataSetName+'</h1><p><b>Archive Type: </b>'+feature.properties.archiveType+'<br><a href="https://lipdverse.org/data/'+feature.properties.datasetId+'" target="_blank">Dataset URL</a><br><b>Proxies: </b>'+feature.properties.paleoData_proxy+'<br><b>Min/Max Age: </b>'+feature.properties.minAge+' / '+feature.properties.maxAge+' yr BP</p><iframe src="/query/paleoPlots/'+feature.properties.datasetId+'" height="200" width="600" title="paleoData Plot"></iframe>', {
		   maxWidth : 600
	    });
	},

	filter: function(feature, layer) {
	    // Check if point is within coordinate bounds
	    var lat = feature.geometry.coordinates[1];
	    var lon = feature.geometry.coordinates[0];
	    var isInBounds = lat >= rectCoord.South && lat <= rectCoord.North &&
	                     lon >= rectCoord.West && lon <= rectCoord.East;
	    if (isInBounds) {
		inRectCount = inRectCount + 1;
	    }
	    // Debug: log first few filtered points
	    if (inRectCount <= 3) {
		console.log('Filter check: lat=' + lat + ', lon=' + lon + ', isInBounds=' + isInBounds, ', bounds=', rectCoord);
	    }
	    return isInBounds;
	},

		pointToLayer : function(feature, latlng) {
	    var col1 = chooseColor(feature.properties.archiveType, feature.properties.interp_Vars, feature.properties.paleoData_proxy)
	    var aType = feature.properties.archiveType
	    var shape1 = chooseShape(feature.properties.archiveType, feature.properties.interp_Vars, feature.properties.paleoData_proxy)
	    var radius1 = 4
	    if (aType == "Documents"){
		radius1 = 6
	    }
	    // Only use special ice icons for archiveType mode
	    var usingArchiveMode = (typeof window.legendMode === 'undefined' || window.legendMode === 'archiveType');
	    if (aType == "GroundIce" && usingArchiveMode){
		return L.marker(latlng, {
		    icon: groundIce
		});
	    } else if (aType == "GlacierIce" && usingArchiveMode){
		return L.marker(latlng, {
		    icon: glacierIce
		});
	    } else {
			    return L.shapeMarker(latlng, {

				radius : radius1,
				fillColor : col1,
				color : col1,
				weight : 1,
		    fillOpacity : 0.8,
		    shape : shape1,
		    opacity : 0.1

			    });
	    }
		}
	    }).addTo(layerGroup);
    document.getElementById("datasetCount").innerHTML = "Total datasets in query: " + coords.length + " (" + inRectCount + " unique locations) &mdash; datasets may contain multiple proxy time series"
    document.getElementById("my-css-spinner").style.display = "none";
}
