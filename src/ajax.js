function Request() {
  var self = this;
  
  self.https     = require("https");
  self.http      = require("http");
  self.urlParser = require("url");
  
  self.submit = function (options, post, fn) {
    var response = ""; 
    var client   = options.protocol == 'https:' ? self.https : self.http;
    
    var req = client.request(options, function(resp){
      
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

var request = new Request();
/*
module.exports.get = function (url, fn) { 
  var options = this.urlParser.parse(url);
  
  options.method          = "GET";
  options.withCredentials = false;
  
  request.submit(options, null, fn);
}  

module.exports.post = function (options, fn) {
  if (!options.url) return fn(new Error("Invalid URL"));
  var params = this.urlParser.parse(options.url);
  
  params.method          = "POST";
  params.withCredentials = false;  
  request.submit(params, options.data || {}, fn);
}
*/
module.exports.ajax = function (options) {
  
  var url       = Array.isArray(options.url) ? options.url[0] : options.url;
  var params    = request.urlParser.parse(url || "");
  params.method = options.type || "GET";
  params.withCredentials = false;
  if (!options.dataType) options.dataType = 'text';
    
  request.submit(params, options.data || {}, function (err, resp){
    if (err && options.error) return options.error(err);
    if (options.success) {
      if (options.dataType==='json') resp.text = JSON.parse(resp.text);
      return options.success(resp.text);
    }
  });
}
