var ripple  = require('ripple-lib');
var sjcl    = ripple.sjcl;
var request = require('superagent'); 
var extend  = require("extend");

var Base58Utils   = require('./base58');
var RippleAddress = require('./types').RippleAddress;

var cryptConfig = {
  cipher : "aes",
  mode   : "ccm",
  ts     : 64,   // tag length
  ks     : 256,  // key size
  iter   : 1000  // iterations (key derivation)
};


// Full domain hash based on SHA512
function fdh(data, bytelen)
{
  var bitlen = bytelen << 3;

  if (typeof data === "string") {
    data = sjcl.codec.utf8String.toBits(data);
  }

  // Add hashing rounds until we exceed desired length in bits
  var counter = 0, output = [];
  while (sjcl.bitArray.bitLength(output) < bitlen) {
    var hash = sjcl.hash.sha512.hash(sjcl.bitArray.concat([counter], data));
    output = sjcl.bitArray.concat(output, hash);
    counter++;
  }

  // Truncate to desired length
  output = sjcl.bitArray.clamp(output, bitlen);

  return output;
}


// This is a function to derive different hashes from the same key. Each hash
// is derived as HMAC-SHA512HALF(key, token).
function keyHash(key, token) {
  var hmac = new sjcl.misc.hmac(key, sjcl.hash.sha512);
  return sjcl.codec.hex.fromBits(sjcl.bitArray.bitSlice(hmac.encrypt(token), 0, 256));
}
  

/****** exposed functions ******/


/**
 * KEY DERIVATION FUNCTION
 *
 * This service takes care of the key derivation, i.e. converting low-entropy
 * secret into higher entropy secret via either computationally expensive
 * processes or peer-assisted key derivation (PAKDF).
 */
module.exports.derive = function (opts, purpose, username, secret, fn) {

  var tokens;
  if (purpose=='login') tokens = ['id', 'crypt'];
  else                  tokens = ['unlock'];

  var iExponent = new sjcl.bn(String(opts.exponent)),
      iModulus  = new sjcl.bn(String(opts.modulus)),
      iAlpha    = new sjcl.bn(String(opts.alpha));

  var publicInfo = "PAKDF_1_0_0:"+opts.host.length+":"+opts.host+
        ":"+username.length+":"+username+
        ":"+purpose.length+":"+purpose+
        ":",
      publicSize = Math.ceil(Math.min((7+iModulus.bitLength()) >>> 3, 256)/8),
      publicHash = fdh(publicInfo, publicSize),
      publicHex  = sjcl.codec.hex.fromBits(publicHash),
      iPublic    = new sjcl.bn(String(publicHex)).setBitM(0),
      secretInfo = publicInfo+":"+secret.length+":"+secret+":",
      secretSize = (7+iModulus.bitLength()) >>> 3,
      secretHash = fdh(secretInfo, secretSize),
      secretHex  = sjcl.codec.hex.fromBits(secretHash),
      iSecret    = new sjcl.bn(String(secretHex)).mod(iModulus);

  if (iSecret.jacobi(iModulus) !== 1) {
    iSecret = iSecret.mul(iAlpha).mod(iModulus);
  }

  var iRandom;
  for (;;) {
    iRandom = sjcl.bn.random(iModulus, 0);
    if (iRandom.jacobi(iModulus) === 1)
      break;
  }

  var iBlind   = iRandom.powermodMontgomery(iPublic.mul(iExponent), iModulus),
      iSignreq = iSecret.mulmod(iBlind, iModulus),
      signreq  = sjcl.codec.hex.fromBits(iSignreq.toBits());
  
  request.post(opts.url)
    .send({
      info    : publicInfo,
      signreq : signreq
    }).end(function(err, resp) {
    
    if (err || !resp) return fn(new Error("Could not query PAKDF server "+opts.host));  
    
    var data = resp.body || resp.text ? JSON.parse(resp.text) : {};
    
    if (!data.result=='success') return fn(new Error("Could not query PAKDF server "+opts.host)); 
    
    var iSignres = new sjcl.bn(String(data.signres));
      iRandomInv = iRandom.inverseMod(iModulus),
      iSigned    = iSignres.mulmod(iRandomInv, iModulus),
      key        = iSigned.toBits(),
      result     = {};
    
    tokens.forEach(function (token) {
      result[token] = keyHash(key, token);
    });
                        
    fn (null, result);     
  }); 
}


module.exports.encrypt = function(key, data)
{
  key = sjcl.codec.hex.toBits(key);

  var opts = extend(true, {}, cryptConfig);

  var encryptedObj = JSON.parse(sjcl.encrypt(key, data, opts));
  var version = [sjcl.bitArray.partial(8, 0)];
  var initVector = sjcl.codec.base64.toBits(encryptedObj.iv);
  var ciphertext = sjcl.codec.base64.toBits(encryptedObj.ct);

  var encryptedBits = sjcl.bitArray.concat(version, initVector);
  encryptedBits = sjcl.bitArray.concat(encryptedBits, ciphertext);

  return sjcl.codec.base64.fromBits(encryptedBits);
}


module.exports.decrypt = function(key, data)
{
  key = sjcl.codec.hex.toBits(key);
  var encryptedBits = sjcl.codec.base64.toBits(data);

  var version = sjcl.bitArray.extract(encryptedBits, 0, 8);

  if (version !== 0) {
    throw new Error("Unsupported encryption version: "+version);
  }

  var encrypted = extend(true, {}, cryptConfig, {
    iv: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8, 8+128)),
    ct: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8+128))
  });

  return sjcl.decrypt(key, JSON.stringify(encrypted));
} 

module.exports.isValidAddress = function (address) {
  return ripple.UInt160.is_valid(address);
}

module.exports.createSecret = function (words) {
  return sjcl.codec.hex.fromBits(sjcl.random.randomWords(words));
}

module.exports.createMaster = function () {
  return Base58Utils.encode_base_check(33, sjcl.codec.bytes.fromBits(sjcl.random.randomWords(4)));
}

module.exports.getAddress = function (masterkey) {
  return new RippleAddress(masterkey).getAddress();
}

module.exports.hashSha512 = function (data) {
  return sjcl.codec.hex.fromBits(sjcl.hash.sha512.hash(data)); 
}

module.exports.signature = function (secret, data) {
  var hmac = new sjcl.misc.hmac(sjcl.codec.hex.toBits(secret), sjcl.hash.sha512);
  return sjcl.codec.hex.fromBits(hmac.mac(data));
}

module.exports.signMessage = ripple.Message.signMessage;

module.exports.deriveRecoveryEncryptionKeyFromSecret = function(secret) {
  var seed = ripple.Seed.from_json(secret).to_bits();
  var hmac = new sjcl.misc.hmac(seed, sjcl.hash.sha512);
  var key  = hmac.mac("ripple/hmac/recovery_encryption_key/v1");
  key      = sjcl.bitArray.bitSlice(key, 0, 256);
  return sjcl.codec.hex.fromBits(key);
}

/**
 * Convert base64 encoded data into base64url encoded data.
 *
 * @param {String} base64 Data
 */
module.exports.base64ToBase64Url = function (encodedData) {
  return encodedData.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
};

/**
 * Convert base64url encoded data into base64 encoded data.
 *
 * @param {String} base64 Data
 */
module.exports.base64UrlToBase64 = function (encodedData) {
  encodedData = encodedData.replace(/-/g, '+').replace(/_/g, '/');
  while (encodedData.length % 4) {
    encodedData += '=';
  }
  return encodedData;
};