# Paleo Presto Server

This repo contains the four node.js apps that constitude the Paleo Presto Custom Reconstruction Engine. These apps live on the Presto2 droplet on Digital Ocean at 143.198.98.66

In addition to the four node apps, the nginx config files are also present. On a linux server, these files live at /etc/nginx/sites-enabled/

Note that several of the node apps have hard-coded references to paths on the current server

## Notes for adding a new reconstruction

### Container

Reconstruction algorithms should run when a container is launched based on a paramters file - ideally a yaml file following the [PReSto input standard](https://github.com/paleopresto/prestoRecons/blob/main/presto_input_standards.md)

The container should be pulled onto the server

### formServer

The new reconstruction will need its own directory added under prestoForm with the following elements:
* introductory text (formIntro.txt) [see example](https://github.com/DaveEdge1/prestoServer/blob/master/prestoForm/temp12k/formIntro.txt)
* standardized configuration file (configs.yml) [PReSto input standard](https://github.com/paleopresto/prestoRecons/blob/main/presto_input_standards.md)
* if the reconstruction is not strucured to run with the standardized config file
	* the working configs file (ideally params.json or params.yml)
	* dictionary of variable synonyms [example](https://github.com/DaveEdge1/prestoServer/blob/master/prestoForm/holocene_da/lookup.json)
	* translation function from standard configs (edited by user) to 'working configs' for algorithm ingestion [example](https://github.com/DaveEdge1/prestoServer/blob/master/prestoForm/holocene_da/translate.js)

Basic recon info added to prestoForm/index.html:
* Title
* Duration
* name(s) and URL(s) of proxy database(s)
* name(s) and URL(s) of model(s)
* name of methodology
* publication doi

### queryServer

GUI for interaction with lipdverse data
* utilizes a SQL server, which contains 21 variables for each time series on the lipdverse
* pulls time series for downlaod from the graphDB
* Filter lipdverse data for use in reconstruction
* download data directly as csv
* (coming soon) download data as zipped .lpd files, .rds file, or as .pkl
* Filters preset based on reconstruction configs.yml (via jsoon intermediary)

### editorServer

Build web form for interactive parameter editing:
* add reconstruction title to jsonEditor/reconTitles.json
* run "node jsonEditor/writeForm.js"
* custom html and js will be generated

### prestoServer

Launch the recon algorithm:
* handle (holocene_da)
* full title (Holocene DA Reconstruction)
* params location in container (':/config_default.yml')
* results directory (':/resultsl')
* github URL (https://github.com/Holocene-Reconstruction/Holocene-code)
* container tag (lipd_webapps:holocene_da)
* path to params file to use in container ('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml')
* path to working config file ('/root/presto/prestoForm/holocene_da/config_default.yml')  
* paths to standardized configs and lookup.json are standardized by recon handle

Produce visualizations:
* await removal of docker container
* launch shell script which runs 3 sequential python scripts

Send email to user:
* await creation of viz products
* send email with links to access products

### downloadServer
Access processed data, visualizations, and logs
* download all files (zipped)
* view vizualiations on the web
* browse files created and download individually
