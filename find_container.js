var shelljs = require("shelljs");
//var JSON = require("json");

//var names = exec('docker ps --format json { "Names": "{{.Names}}" }')

//var cont_status = exec('docker inspect test2')
//console.log(cont_status)
//console.log(cont_status.connected)
docker_status = shelljs.exec('docker run -d --rm --name test2 hello_world').stdout
docker_status = shelljs.exec('docker ps -a').stdout
//console.log(docker_status)
//console.log(docker_status.search("test2"))
//console.log(docker_status.search("test3"))

console.log(docker_status.search("test2") != -1)

await_removal = async function(){
	if (docker_status.search("test2") != -1){
		console.log('awaiting removal')
		//console.log('docker_status.search("test2") !== -1: ' + docker_status.search("test2") !== -1)
		while (docker_status.search("test2") != -1){
			docker_status = shelljs.exec('docker ps -a').stdout
		}
		console.log('constainer removed')
		return 'done'
	}
}

await_removal()
//console.log(names)
//console.log(exec("$( docker container inspect -f '{{.State.Running}}' $test2 )"))
//console.log("$( docker container inspect -f '{{.State.Running}}' $test2 )" == "running")
//console.log("$( docker container inspect -f '{{.State.Running}}' $test2 )" == "exited")
//console.log("$( docker container inspect -f '{{.State.Running}}' $test )" == "true")
