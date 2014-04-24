var $     = require('./ajax');
var crypt = require('./crypt');


//Blob object class
var BlobObj = function (url, id, key) {
  this.url  = url;
  this.id   = id;
  this.key  = key;
  this.data = {};
};

//init new blob object
BlobObj.prototype.init = function (fn) {
  var self = this;
  if (self.url.indexOf("://") === -1) self.url = "http://" + url;

  $.ajax({
    url      : self.url + '/v1/blob/' + self.id,
    dataType : 'json',
    timeout  : 8000,
    success  : function (data) {
      if (data.result === "success") {
        self.revision = data.revision;
      
        if (!self.decrypt(data.blob)) {
          return fn(new Error("Error while decrypting blob"));
        }
        
        // TODO: Apply patches
/*
        if (data.patches && data.patches.length) {
          var successful = true;
          data.patches.forEach(function (i, patch) {
            successful = successful && blob.applyEncryptedPatch(patch);
          });
  
          if (successful) blob.consolidate();
        }
*/        
        fn(null, self);//return with newly decrypted blob
        
      } else {
        fn(new Error("Could not retrieve blob"));
      }      
    },
    error : function (err) {
     fn(err);
  }});    
} 


//apply encrypted patch
BlobObj.prototype.applyEncryptedPatch = function (patch)
{
  return true;
  /*
  try {
    var params = JSON.parse(crypt.decrypt(this.key, patch));
    var op     = params.shift();
    var path   = params.shift();

    this.applyUpdate(op, path, params);

    this.revision++;

    return true;
  } catch (err) {
    console.log("client: blob: failed to apply patch:", err.toString());
    console.log(err.stack);
    return false;
  }
  */
}

//decrypt secret with unlock key
BlobObj.prototype.decryptSecret = function (secretUnlockKey) {
  return crypt.decrypt(secretUnlockKey, this.data.encrypted_secret);
};


//encrypt secret with unlock key
BlobObj.prototype.encryptSecret = function (secretUnlockKey, secret) {
  return crypt.encrypt(secretUnlockKey, secret);
};
   

//decrypt blob with crypt key   
BlobObj.prototype.decrypt = function (data) {
  
  try {
    this.data = JSON.parse(crypt.decrypt(this.key, data));
    return this;
  } catch (e) {
    console.log("client: blob: decryption failed", e.toString());
    console.log(e.stack);
    return false;
  }
};


//encrypt blob data with crypt key
BlobObj.prototype.encrypt = function()
{
  
// Filter Angular metadata before encryption
//  if ('object' === typeof this.data &&
//      'object' === typeof this.data.contacts)
//    this.data.contacts = angular.fromJson(angular.toJson(this.data.contacts));

  return crypt.encrypt(this.key, JSON.stringify(this.data));
};




/***** exposed methods ****/


//blob object class
module.exports.Blob = BlobObj

  
//retrive a blob with url, id and key  
module.exports.get = function (url, id, crypt, fn) {

  var blob = new BlobObj(url, id, crypt);
  blob.init(fn);
}


//verify email address
module.exports.verify = function (url, username, token, fn) {

  $.ajax({
    method   : 'GET',
    dataType : 'json',
    url      : url + '/v1/user/' + username + '/verify/' + token,
    success  : function(data) {
      if (data.result === "success") return fn(null, data);
      else return fn(new Error("Failed to verify the account"));
    },
    error: function(err) {
      return fn(err);
    }
  });
}


/**
 * Create a blob object
 *
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.id
 * @param {string} options.crypt
 * @param {string} options.unlock
 * @param {string} options.username
 * @param {string} options.masterkey
 * @param {object} options.oldUserBlob
 * @param {function} callback
 */
module.exports.create = function (options, fn)
{
  console.log(options);
  
  var blob      = new BlobObj(options.url, options.id, options.crypt);
  blob.revision = 0;
  blob.data     = {
    auth_secret      : crypt.createSecret(8),
    encrypted_secret : blob.encryptSecret(options.unlock, options.masterkey),
    account_id       : crypt.getAddress(options.masterkey),
    email            : options.email,
    contacts         : [],
    created          : (new Date()).toJSON()
  };

  // Migration
  if (options.oldUserBlob) {
    blob.data.contacts = options.oldUserBlob.data.contacts;
  }
  
  //post to the blob vault to create
  $.ajax({
    type     : "POST",
    url      : options.url + '/v1/user',
    dataType : 'json',
    data : {
      blob_id     : options.id,
      username    : options.username,
      address     : blob.data.account_id,
      signature   : "",
      pubkey      : "",
      auth_secret : blob.data.auth_secret,
      data        : blob.encrypt(),
      email       : options.email,
      hostlink    : options.activateLink
    },
    timeout : 8000,
    success : function (data) {
      console.log(data);
      if (data.result === "success") return fn(null, blob, data);
      else return fn(new Error("Could not create blob"));
    },
    error  : function(err) {
      return fn(err);
  }});
}
  