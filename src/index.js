var AuthInfo   = require('./authinfo');
var blobClient = require('./blob');
var kdf        = require('./kdf');

function VaultClient(opts) {
  if (!opts) opts = {};  
  else if (typeof opts === "string") opts = {domain:opts};
  
  this.domain    = opts.domain || 'ripple.com';
  this.authInfo  = new AuthInfo;
};



VaultClient.prototype.login = function(username, password, fn) {
  var self = this;
  
  self.authInfo.get(self.domain, username, function(err, authInfo){
    if (err) return fn(err);

    console.log(authInfo);
    
    if (authInfo.version !== 3) {
      return fn(new Error("This wallet is incompatible with this version of ripple-client."));
    }
    
    if (!authInfo.pakdf) {
      return fn(new Error("No settings for PAKDF in auth packet."));
    }

    if (!authInfo.exists) {
      return fn(new Error("User does not exist."));
    }

    if ("string" !== typeof authInfo.blobvault) {
      return fn(new Error("No blobvault specified in the authinfo."));
    }
                  
    //derive login keys
    kdf.deriveRemotely(authInfo.pakdf, 'login', username.toLowerCase(), password, function(err, keys){
      if (err) return fn(err);
      
      blobClient.get(authInfo.blobvault, keys.id, keys.crypt, function (err, blob) {
        if (err) return fn(err);
        
        fn (null, {
          blob     : blob,
          keys     : keys 
        });
      });
    });
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
