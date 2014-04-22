var $          = require('./ajax');
var crypt      = require('./crypt');

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
        
        fn(null, self);//return with newly decrypted blob
        
      } else {
        fn(new Error("Could not retrieve blob"));
      }      
    },
    error : function (err) {
     fn(err);
  }});    
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

  
//retrive a blob with url, id and key  
module.exports.get = function (url, id, crypt, fn) {

  var blob = new BlobObj(url, id, crypt);
  blob.init(fn);
}


//blob object class
module.exports.Blob = BlobObj