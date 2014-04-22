var AuthInfo   = require('./authinfo');
var blobClient = require('./blob');
var crypt      = require('./crypt');

function VaultClient(opts) {
  if (!opts) opts = {};  
  else if (typeof opts === "string") opts = {domain:opts};
  
  this.domain    = opts.domain || 'ripple.com';
  this.authInfo  = new AuthInfo;
  this.infos     = {};
};


/*
 * Login -
 * authenticate and retrieve a decrypted blob using a ripple name and password
 * 
 */
VaultClient.prototype.login = function(username, password, fn) {
  var self = this;
  
  self.authInfo.get(self.domain, username, function(err, authInfo){
    if (err) return fn(err);
    
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
    crypt.derive(authInfo.pakdf, 'login', username.toLowerCase(), password, function(err, keys){
      if (err) return fn(err);
      
      blobClient.get(authInfo.blobvault, keys.id, keys.crypt, function (err, blob) {
        if (err) return fn(err);
        
        self.infos[keys.id] = authInfo;  //save for relogin
        
        fn (null, {
          blob     : blob,
          keys     : keys,
          username : authInfo.username  
        });
      });
    });
  });
};


/*
 * Relogin -
 * retreive and decrypt blob using id and crypt derived previously.
 * 
 */
VaultClient.prototype.relogin = function(id, cryptKey, fn) { 
  var authInfo = this.infos[id]; 
  
  if (!authInfo) return fn(new Error("Unable to find authInfo"));
  
  blobClient.get(authInfo.blobvault, id, cryptKey, function (err, blob) {
    if (err) return fn(err);
    
    fn (null, {
      blob : blob,
    });
  });
};


/*
 * Unlock - 
 * decrypt the secret key using a username and password
 */
VaultClient.prototype.unlock = function(username, password, encryptSecret, fn) {
  var self = this;
  
  self.authInfo.get(self.domain, username, function(err, authInfo){
    if (err) return fn(err);
    
    //derive unlock key
    crypt.derive(authInfo.pakdf, 'unlock', username.toLowerCase(), password, function(err, keys){
      if (err) return fn(err);
      
      fn(null, {
        keys   : keys,
        secret : crypt.decrypt(keys.unlock, encryptSecret)
      });      
    }); 
  });
};


/*
 * LoginAndUnlock
 * retrieve the decrypted blob and secret key in one step using
 * the username and password
 * 
 */
VaultClient.prototype.loginAndUnlock = function(username, password, fn) {
  var self = this;
  
  this.login(username, password, function(err, resp){
    if (err) return fn(err);
    
    if (!resp.blob || 
        !resp.blob.data ||
        !resp.blob.data.encrypted_secret) 
      return (new Error("Unable to retrieve blob and secret."));
    
    if (!resp.keys) return (new Error("Unable to retrieve keys."));
       
    //get authInfo via id - would have been saved from login
    var authInfo = self.infos[resp.keys.id]; 
    if (!authInfo) return fn(new Error("Unable to find authInfo"));
      
    //derive unlock key
    crypt.derive(authInfo.pakdf, 'unlock', username.toLowerCase(), password, function(err, keys){
      if (err) return fn(err); 
      fn(null, {
        blob : resp.blob,
        keys : {
          id     : resp.keys.id,
          crypt  : resp.keys.crypt,
          unlock : keys.unlock
        },
        secret   : crypt.decrypt(keys.unlock, resp.blob.data.encrypted_secret),
        username : authInfo.username
      });
    });     
  });
};

module.exports = VaultClient;
