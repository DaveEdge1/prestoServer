PORT = process.env.PORT || 3002

var fs = require('fs')
var YAML = require('yaml')
var json = require('json')
var hrefConfig = ''
var titleHeading = 'Configure Reconstruction Paramaters'

var express = require('express'),
    app = express()

const path = require("path")
const multer = require("multer")


var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.json());

app.set('trust proxy', true);

//const jsdom = require("jsdom");
//const { JSDOM } = jsdom;
//const { document } = (new JSDOM.fromFile("/root/prestoForm/index.html")).window;

//var dom1 = ''
//var DOM = ''

//const frontPage = async () => { 
//  dom1 = await JSDOM.fromFile("index.html",
//  { includeNodeLocations: true });
//  var dom = await dom1.serialize();
//  return dom
//}
//frontPage().then((res)=>DOM=res);
  //return dom.serialize()
//
//
//var dom2 = ''
//var DOM2 = ''


//var frontPage2 = async function ()  { 
//  dom2 = await JSDOM.fromURL("http://68.183.108.187:84/",
//  { includeNodeLocations: true });
//  var dom2 = await dom2.serialize();
//  return dom2
//}
//frontPage2().then((res)=>DOM2=res);

//start ejs engine for upload page
app.set("views",path.join(__dirname,"views"))
app.set("view engine","ejs")
    
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
  
        cb(null, "uploads")
    },
    filename: function (req, file, cb) {
      cb(null, "config_default.yml")
    }
  })
       
const maxSize = 1 * 1000 * 10;
    
var upload = multer({ 
    storage: storage,
    limits: { fileSize: maxSize },
    fileFilter: function (req, file, cb){
    
        var filetypes = /json|yml/;
  
        var extname = filetypes.test(path.extname(
                    file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        }
     
        cb("Error: File upload only supports the "
                + "following filetypes - " + filetypes);
      } 
  
}).single("conf");       

//app.use(express.static('public'))
app.use('/', express.static(path.join(__dirname, 'public')))

//app.use('/scripts', express.static('/root/prestoForm/node_modules/fs/'));

const ejs_helpers = require('/root/presto/prestoForm/helpers.js')

var doSomething = function(){
  console.log('selection changed');
};


app.get('/down', function (req, res) {
    //res.end(dom1.serialize());
    //res.sendFile("/root/presto/prestoForm/index.html")
    res.send("Sorry, the Presto Custom Recontruction Engine is currently down for maintenance.<br>We'll be back soon!.<br><br><br>" + '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>')
    //console.log(dom1.window.document.getElementById("abstract").src)
    //console.log(dom1.window.document.getElementById("selectpicker").value)
});

app.get('/', function (req, res) {
	console.log(req.ip)
	//res.sendFile("/root/presto/prestoForm/index.html")
	res.send("Sorry, the Presto Custom Recontruction Engine is currently down for maintenance.<br>We'll be back soon!.<br><br><br>" + '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>')

});

app.get('/query', function (req, res) {
	        res.send(req.query.id+'<br>'+req.query.num)
});


app.post('/getUserInfo', function (req, res) {

   if (req.query.recon === 'temp12k') {
        var hrefConfig = 'https://github.com/paleopresto/temp12k-regional-composites'
   }
   
    res.sendFile('/root/presto/prestoForm/index2.html');

});

app.get('/configDownload', function(req, res) {
	if (reconPicker === 'holocene_da') {
        //const s = fs.readFileSync('/root/presto/holocene_da/config_default.yml','utf8');
	const s = fs.readFileSync('/root/presto/presto/holocene_da/holoceneDA_configs_standardized.yml','utf8');
	res.send(YAML.parse(s))
	}
	if (reconPicker === 'temp12k') {
	  const s = fs.readFileSync('/root/presto/presto/temp12k/params.json','utf8');
          res.send(JSON.parse(s))
	  console.log(JSON.parse(s))
	}
})

app.post('/manualORdefault', function (req, res) {
	//reconpicker = req.query.recon 
	//useremail = req.body.useremail;
	//parsedUser = useremail.split('@')[0];
	//parsedDomain = useremail.split('@')[1];
	//console.log(parsedUser)
	//console.log(parsedDomain)
	//var downloadpath = 'http://137.184.4.96:81/' + req.query.recon +  '/' + req.query.email.split('@')[0] + '/' + req.query.email.split('@')[1] + '/default'
        var editorpath = function() { return ('http://143.198.98.66:85/?recon=' + req.query.recon + '&user=' + req.query.email.split('@')[0] + '&domain=' + req.query.email.split('@')[1] + '&uniqueID=' + req.query.uniqueID)}
	whichRecon = function(reconPicker){
        	if (reconPicker === 'temp12k') {
	  		var titleHeading = 'Configure Temperature 12k Paramaters'
          		var hrefConfig = 'https://github.com/paleopresto/temp12k-regional-composites'
		} else if (reconPicker === 'holocene_da') {
	  		var titleHeading = 'Configure Holocene DA Paramaters'
          		var hrefConfig = 'https://github.com/Holocene-Reconstruction/Holocene-code/blob/main/config_default.yml'
        	}
		return ({hrefConfig, titleHeading})
	}
	if (req.query.parampath === 'on'){
          res.writeHead(302, {
             Location: editorpath()
          });
          res.end();
	}
	else{
	  console.log(hrefConfig);
          res.render("Signup", whichRecon(req.query.recon));
	}

})

app.post("/uploadConfigs",function (req, res, next) {
   

    upload(req,res,function(err) {

        if(err) {
  
            res.send(err)
        }
        else {
  
	    var downloadpath = 'http://143.198.98.66:85:81/' + reconPicker + '/' + parsedUser + '/' + parsedDomain + '/manual'
	    res.writeHead(302, {
              Location: downloadpath
            });
            res.end();
            } 
    })
})

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
