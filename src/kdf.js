/**
 * KEY DERIVATION FUNCTION
 *
 * This service takes care of the key derivation, i.e. converting low-entropy
 * secret into higher entropy secret via either computationally expensive
 * processes or peer-assisted key derivation (PAKDF).
 */

var ripple  = require('ripple-lib');
var sjcl    = ripple.sjcl;
var $       = require('./ajax');

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
  

module.exports.deriveRemotely = function (opts, purpose, username, secret, fn) {

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
  
  $.ajax({
    type : "POST",
    url  : opts.url,
    data : {
      info    : publicInfo,
      signreq : signreq
    },
    dataType : 'json',
    success  : function(data) {

      if (data.result === "success") {
        var iSignres   = new sjcl.bn(String(data.signres));
        var iRandomInv = iRandom.inverseMod(iModulus);
        var iSigned    = iSignres.mulmod(iRandomInv, iModulus);
        var key        = iSigned.toBits();

        fn (null, {
          id    : keyHash(key, "id"),
          crypt : keyHash(key, "crypt")
        });
      } else {
        // XXX Handle error
      }        
    },
    error    : function() {
      fn(new Error("Could not query PAKDF server "+opts.host));  
    } 
  });
}

