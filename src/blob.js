var $          = require('./ajax');
var ripple     = require('ripple-lib');
var sjcl       = ripple.sjcl;
var blobClient = new BlobClient;

var cryptConfig = {
  cipher : "aes",
  mode   : "ccm",
  ts     : 64,   // tag length
  ks     : 256,  // key size
  iter   : 1000  // iterations (key derivation)
};

var BlobObj = function (url, id, key) {
  this.url  = url;
  this.id   = id;
  this.key  = key;
  this.data = {};
};

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
        fn(null, self);
        
      } else {
        fn(new Error("Could not retrieve blob"));
      }      
    },
    error : function (err) {
     fn(err);
  }});    
} 
 
BlobObj.prototype.decrypt = function (data) {
  
  try {
    this.data = JSON.parse(decrypt(this.key, data));
    return this;
  } catch (e) {
    console.log("client: blob: decryption failed", e.toString());
    console.log(e.stack);
    return false;
  }
};
  
function extend(obj, obj2) {
  var newObject = JSON.parse(JSON.stringify(obj));
  if (obj2) for (var key in obj2) newObject[key] = obj2[key];
  return newObject;
} 
 
function encrypt(key, data)
{
  key = sjcl.codec.hex.toBits(key);

  var opts = extend(cryptConfig);

  var encryptedObj = JSON.parse(sjcl.encrypt(key, data, opts));
  var version = [sjcl.bitArray.partial(8, 0)];
  var initVector = sjcl.codec.base64.toBits(encryptedObj.iv);
  var ciphertext = sjcl.codec.base64.toBits(encryptedObj.ct);

  var encryptedBits = sjcl.bitArray.concat(version, initVector);
  encryptedBits = sjcl.bitArray.concat(encryptedBits, ciphertext);

  return sjcl.codec.base64.fromBits(encryptedBits);
}

function decrypt(key, data)
{
  key = sjcl.codec.hex.toBits(key);
  var encryptedBits = sjcl.codec.base64.toBits(data);

  var version = sjcl.bitArray.extract(encryptedBits, 0, 8);

  if (version !== 0) {
    throw new Error("Unsupported encryption version: "+version);
  }

  var encrypted = extend(cryptConfig, {
    iv: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8, 8+128)),
    ct: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8+128))
  });

  return sjcl.decrypt(key, JSON.stringify(encrypted));
}  

function BlobClient () {
  var self = this;
  
  this.get = function (url, id, crypt, fn) {
    var blob = new BlobObj(url, id, crypt);
    blob.init(fn);
  }
}

module.exports = blobClient;
