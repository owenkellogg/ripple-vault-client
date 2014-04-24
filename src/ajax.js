function Request() {
  var self = this;
  
  self.https     = require("https");
  self.http      = require("http");
  self.urlParser = require("url");
  
  self.submit = function (options, post, fn) {
    var response = "", timeout; 
    var client   = options.protocol == 'https:' ? self.https : self.http;
    if (post) options.headers = {"Content-Type" : "application/json"};
    
    options.rejectUnauthorized = false;
    
    var req = client.request(options, function(resp){
      
      
      resp.on('data', function(data){
        response += data;
      });   
      
      resp.on('end', function(){
        clearTimeout(timeout);
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
      
      //handle response error
      resp.on('error', function(err){
        clearTimeout(timeout);
        fn(err);  
      });
      
    });
    
    if (post) req.write(post);
    req.end(); 
    
    //handle request error
    req.on('error', function(err){
      req.destroy();
      clearTimeout(timeout);
      fn(err); 
    });
    
    if (options.timeout) {
      timeout = setTimeout(function(){
        req.destroy();
        fn({
          status : 408,
          text   : "Request timeout"
        });
      }, options.timeout);
    }
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
  var data      = options.data ? JSON.stringify(options.data) : null;
  params.method = options.type || (data ? "POST":"GET");
  params.withCredentials = false;
  if (options.timeout)   params.timeout   = options.timeout;
  if (!options.dataType) options.dataType = 'text';

  request.submit(params, data, function (err, resp){
    if (err && options.error) {
      if (options.dataType==='json') err.text = JSON.parse(err.text);
      return options.error(err.text);
    }
    
    if (options.success) {
      if (options.dataType==='json') resp.text = JSON.parse(resp.text);
      return options.success(resp.text);
    }
  });
}
