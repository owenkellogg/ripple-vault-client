var RippleTxt = require('./rippletxt');
var $         = require('./ajax');

function AuthInfo () {
  this.rippleTxt = new RippleTxt;
}

//Can I cache the auth info for later use?
AuthInfo.prototype.get = function (domain, username, fn) {
  var self = this;
  
  self.rippleTxt.get(domain, function(err, txt){
    if (err) return fn(err);
    
    processTxt(txt)
  });
  
  
  function processTxt(txt) {

    if (!txt.authinfo_url) return fn(new Error("Authentication is not supported on "+domain));
    var url = Array.isArray(txt.authinfo_url) ? txt.authinfo_url[0] : txt.authinfo_url;
    url += "?domain="+domain+"&username="+username;
    
    $.ajax({
      url      : url,
      dataType : "json",
      success  : function (data) { fn(null, data); },
      error    : function ()     { fn(new Error("Authentication info server unreachable")); }
    });
  }  
}

module.exports = AuthInfo;