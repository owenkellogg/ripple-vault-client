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
    if (!txt.authinfo_url) return callback(new Error("Authentication is not supported on "+domain));

    $.ajax({
      url      : txt.authinfo_url,
      dataType : "json",
      data     : {
        domain : domain,
        user   : username
      },
      success  : function (data) { fn(null, data); },
      error    : function ()     { fn(new Error("Authentication info server unreachable")); }
    });
  }  
}

module.exports = AuthInfo;