function Request() {
  this.https     = require("https");
  this.urlParser = require("url");
}

Request.prototype.get = function (url, fn) {
  var response = "";  
  var options  = this.urlParser.parse(url);
  
  options.method          = "GET";
  options.withCredentials = false;
  
  this.https.request(options, function(resp){
    
    resp.on('data', function(data){
      response += data;
    });   
    
    resp.on('end', function(){
      fn(null, {
        status : resp.statusCode,
        text   : response
      });
    });
    
    resp.on('error', function(err){
      fn(err);  
    });
    
  }).end();
}  

module.exports = Request;
