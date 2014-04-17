function Request() {
  var self = this;
  
  self.https     = require("https");
  self.urlParser = require("url");
  
  self.submit = function (options, post, fn) {
    var response = ""; 
      
    var req = self.https.request(options, function(resp){
      
      resp.on('data', function(data){
        response += data;
      });   
      
      resp.on('end', function(){
        if (!resp.statusCode ||
          resp.statusCode>=400) return fn({
          status : resp.statusCode,
          text   : response
        });
        fn(null, {
          status : resp.statusCode,
          text   : response
        });
      });
      
      resp.on('error', function(err){
        fn(err);  
      });
      
    });
    
    if (post) req.write(post);
    req.end();    
  }
}

Request.prototype.get = function (url, fn) { 
  var options = this.urlParser.parse(url);
  
  options.method          = "GET";
  options.withCredentials = false;
  
  this.submit(options, null, fn);
}  

Request.prototype.post = function (options, fn) {
  if (!options.url) return fn(new Error("Invalid URL"));
  var params = this.urlParser.parse(options.url);
  
  params.method          = "POST";
  params.withCredentials = false;  
  this.submit(params, options.data || {}, fn);
}

module.exports = Request;
