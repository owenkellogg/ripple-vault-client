var AuthInfo = require('./authinfo');

function VaultClient(opts) {
  if (!opts) opts = {};  
  else if (typeof opts === "string") opts = {domain:opts};
  
  this.domain    = opts.domain || 'ripple.com';
  this.authInfo  = new AuthInfo;
};



VaultClient.prototype.login = function(username, password, fn) {
  var self = this;
  
  self.authInfo.get(self.domain, username, function(err, res){
    console.log(err, res);  
  });
  
  fn(null, {
    id: true,
    cryptKey: true
  });

};


VaultClient.prototype.relogin = function(id, cryptKey, fn) { 

  fn(null, {
    blob: true
  });

};

VaultClient.prototype.unlock = function(username, password, encryptSecret, fn) {

  fn(null, {
    wallet: {
      secret: true
    }
  });

};

VaultClient.prototype.loginAndUnlock = function(username, password, fn) {

  fn(null, {
    wallet: {
      address: true,
      secret: true
    }
  });

};

module.exports = VaultClient;
