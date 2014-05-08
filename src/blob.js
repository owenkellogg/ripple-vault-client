var $      = require('./ajax');
var crypt  = require('./crypt');
var extend = require("extend");

//Blob object class
var BlobObj = function (url, id, key) {
  this.url  = url;
  this.id   = id;
  this.key  = key;
  this.data = {};  
};

// Blob operations
// Do NOT change the mapping of existing ops
BlobObj.ops = {
  // Special
  "noop" : 0,

  // Simple ops
  "set"     : 16,
  "unset"   : 17,
  "extend"  : 18,

  // Meta ops
  "push"    : 32,
  "pop"     : 33,
  "shift"   : 34,
  "unshift" : 35,
  "filter"  : 36
};


BlobObj.opsReverseMap = [];
for (var name in BlobObj.ops) { 
  BlobObj.opsReverseMap[BlobObj.ops[name]] = name;
}


/*
 * Init -
 * initialize a new blob object
 * 
 */
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
        
        //Apply patches
        if (data.patches && data.patches.length) {
          var successful = true;
          data.patches.forEach(function (patch) {
            successful = successful && self.applyEncryptedPatch(patch);
          });
  
          if (successful) self.consolidate();
        }

        fn(null, self);//return with newly decrypted blob
        
      } else {
        fn(new Error("Could not retrieve blob"));
      }      
    },
    error : function (err) {
     fn(err);
  }});    
} 


/*
 * Consolidate -
 * Consolidate patches as a new revision
 * 
 */
BlobObj.prototype.consolidate = function (fn) {
  
  // Callback is optional
  if ("function" !== typeof fn) fn = function(){};

  console.log("client: blob: consolidation at revision", this.revision);
  var encrypted = this.encrypt();

  var config = {
    method   : 'POST',
    url      : this.url + '/v1/blob/consolidate',
    dataType : 'json',
    data : {
      blob_id  : this.id,
      data     : encrypted,
      revision : this.revision
    },
    success : function(data) {
      if (data.result === "success") {
        return fn(null, data);
      } else {
        console.log("client: blob: could not consolidate:", data);
        return fn(new Error("Failed to consolidate blob"));
      }
    },
    error : function (err) {
      console.log("client: blob: could not consolidate:", +data);

      // XXX Add better error information to exception
      return fn(new Error("Failed to consolidate blob - XHR error"));  
    }  
  };

  $.ajax(this.signRequest(config));
};
  
  
/*
 * ApplyEncryptedPatch -
 * save changes from a downloaded patch to the blob
 * 
 */
BlobObj.prototype.applyEncryptedPatch = function (patch)
{
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



/**** Blob updating ****/


//set blob element
BlobObj.prototype.set = function (pointer, value, fn) {
  this.applyUpdate('set', pointer, [value]);
  this.postUpdate('set', pointer, [value], fn);
};


//get remove blob element
BlobObj.prototype.unset = function (pointer, fn) {
  this.applyUpdate('unset', pointer, []);
  this.postUpdate('unset', pointer, [], fn);
};


//extend blob element
BlobObj.prototype.extend = function (pointer, value, fn) {
  this.applyUpdate('extend', pointer, [value]);
  this.postUpdate('extend', pointer, [value], fn);
};


//Prepend an entry to an array.
BlobObj.prototype.unshift = function (pointer, value, fn) {
  this.applyUpdate('unshift', pointer, [value]);
  this.postUpdate('unshift', pointer, [value], fn);
};


/**
 * Filter the row(s) from an array.
 *
 * This method will find any entries from the array stored under `pointer` and
 * apply the `subcommands` to each of them.
 *
 * The subcommands can be any commands with the pointer parameter left out.
 */
BlobObj.prototype.filter = function (pointer, field, value, subcommands, callback) {
  var params = Array.prototype.slice.apply(arguments);
  if ("function" === typeof params[params.length-1]) {
    callback = params.pop();
  }
  params.shift();

  // Normalize subcommands to minimize the patch size
  params = params.slice(0, 2).concat(normalizeSubcommands(params.slice(2), true));
  
  this.applyUpdate('filter', pointer, params);
  this.postUpdate('filter', pointer, params, callback);
};


//apply new update to the blob data
BlobObj.prototype.applyUpdate = function (op, path, params) {
  
  // Exchange from numeric op code to string
  if ("number" === typeof op) {
    op = BlobObj.opsReverseMap[op];
  }
  if ("string" !== typeof op) {
    throw new Error("Blob update op code must be a number or a valid op id string");
  }

  // Separate each step in the "pointer"
  var pointer = path.split("/");

  var first = pointer.shift();
  if (first !== "") {
    throw new Error("Invalid JSON pointer: "+path);
  }

  this._traverse(this.data, pointer, path, op, params);
};


//for applyUpdate function
BlobObj.prototype._traverse = function (context, pointer,
                                        originalPointer, op, params) {
  var _this = this;
  var part = _this.unescapeToken(pointer.shift());

  if (Array.isArray(context)) {
    if (part === '-') {
      part = context.length;
    } else if (part % 1 !== 0 && part >= 0) {
      throw new Error("Invalid pointer, array element segments must be " +
                      "a positive integer, zero or '-'");
    }
  } else if ("object" !== typeof context) {
    return null;
  } else if (!context.hasOwnProperty(part)) {
    // Some opcodes create the path as they're going along
    if (op === "set") {
      context[part] = {};
    } else if (op === "unshift") {
      context[part] = [];
    } else {
      return null;
    }
  }

  if (pointer.length !== 0) {
    return this._traverse(context[part], pointer,
                          originalPointer, op, params);
  }

  switch (op) {
  case "set":
    context[part] = params[0];
    break;
  case "unset":
    if (Array.isArray(context)) {
      context.splice(part, 1);
    } else {
      delete context[part];
    }
    break;
  case "extend":
    if ("object" !== typeof context[part]) {
      throw new Error("Tried to extend a non-object");
    }
    extend(true, context[part], params[0]);
    break;
  case "unshift":
    if ("undefined" === typeof context[part]) {
      context[part] = [];
    } else if (!Array.isArray(context[part])) {
      throw new Error("Operator 'unshift' must be applied to an array.");
    }
    context[part].unshift(params[0]);
    break;
  case "filter":
    if (Array.isArray(context[part])) {
      context[part].forEach(function (element, i) {
        if ("object" === typeof element &&
            element.hasOwnProperty(params[0]) &&
            element[params[0]] === params[1]) {
          var subpointer = originalPointer+"/"+i;
          var subcommands = normalizeSubcommands(params.slice(2));

          subcommands.forEach(function (subcommand) {
            var op = subcommand[0];
            var pointer = subpointer+subcommand[1];
            _this.applyUpdate(op, pointer, subcommand.slice(2));
          });
        }
      });
    }
    break;
  default:
    throw new Error("Unsupported op "+op);
  }
};


BlobObj.prototype.escapeToken = function (token) {
  return token.replace(/[~\/]/g, function (key) { return key === "~" ? "~0" : "~1"; });
};


BlobObj.prototype.unescapeToken = function(str) {
  return str.replace(/~./g, function(m) {
    switch (m) {
    case "~0":
      return "~";
    case "~1":
      return "/";
    }
    throw("Invalid tilde escape: " + m);
  });
};


//sumbit update to blob vault
BlobObj.prototype.postUpdate = function (op, pointer, params, fn) {
  // Callback is optional
  if ("function" !== typeof fn) fn = function(){};

  if ("string" === typeof op) {
    op = BlobObj.ops[op];
  }
  if ("number" !== typeof op) {
    throw new Error("Blob update op code must be a number or a valid op id string");
  }
  if (op < 0 || op > 255) {
    throw new Error("Blob update op code out of bounds");
  }

  console.log("client: blob: submitting update", BlobObj.opsReverseMap[op], pointer, params);

  params.unshift(pointer);
  params.unshift(op);

  var config = {
    method   : 'POST',
    url      : this.url + '/v1/blob/patch',
    dataType : 'json',
    data     : {
      blob_id : this.id,
      patch   : crypt.encrypt(this.key, JSON.stringify(params))
    },
    
    success : function(data) {
      if (data.result === "success") {
        console.log("client: blob: saved patch as revision", data.revision);
        return fn(null, data);
      } else {
        console.log("client: blob: could not save patch:", data);
        return fn(new Error("Patch could not be saved - bad result"));
      }
    },
    
    error : function(err) {
      console.log("client: blob: could not save patch:", err);
      return fn(new Error("Patch could not be saved - XHR error"));
    }
  };

  $.ajax(this.signRequest(config));
};


//sign an update request to be sent to the blob vault
BlobObj.prototype.signRequest = function (config) {
  config = extend(true, {}, config);

  // XXX This method doesn't handle signing GET requests correctly. The data
  //     field will be merged into the search string, not the request body.

  // Parse URL
  var parsed = $.parse(config.url);

  // Sort the properties of the JSON object into canonical form
  var canonicalData = JSON.stringify(copyObjectWithSortedKeys(config.data));

  
  // Canonical request using Amazon's v4 signature format
  // See: http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
  var canonicalRequest = [
    config.method || 'GET',
    parsed.pathname || '',
    parsed.search || '',
    // XXX Headers signing not supported
    '',
    '',
    crypt.hashSha512(canonicalData).toLowerCase()
  ].join('\n');

  var date = dateAsIso8601();

  // String to sign inspired by Amazon's v4 signature format
  // See: http://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
  //
  // We don't have a credential scope, so we skip it.
  //
  // But that modifies the format, so the format ID is RIPPLE1, instead of AWS4.
  var stringToSign = [
    'RIPPLE1-HMAC-SHA512',
    date,
    crypt.hashSha512(canonicalRequest).toLowerCase()
  ].join('\n');

  var signature = crypt.signature(this.data.auth_secret, stringToSign);

  config.url += (parsed.search ? "&" : "?") +
    'signature='+signature+
    '&signature_date='+date+
    '&signature_blob_id='+this.id;

  return config;
};


/***** helper functions *****/


function normalizeSubcommands(subcommands, compress) {
  // Normalize parameter structure
  if ("number" === typeof subcommands[0] ||
      "string" === typeof subcommands[0]) {
    // Case 1: Single subcommand inline
    subcommands = [subcommands];
  } else if (subcommands.length === 1 &&
             Array.isArray(subcommands[0]) &&
             ("number" === typeof subcommands[0][0] ||
              "string" === typeof subcommands[0][0])) {
    // Case 2: Single subcommand as array
    // (nothing to do)
  } else if (Array.isArray(subcommands[0])) {
    // Case 3: Multiple subcommands as array of arrays
    subcommands = subcommands[0];
  }

  // Normalize op name and convert strings to numeric codes
  subcommands = subcommands.map(function (subcommand) {
    if ("string" === typeof subcommand[0]) {
      subcommand[0] = BlobObj.ops[subcommand[0]];
    }
    if ("number" !== typeof subcommand[0]) {
      throw new Error("Invalid op in subcommand");
    }
    if ("string" !== typeof subcommand[1]) {
      throw new Error("Invalid path in subcommand");
    }
    return subcommand;
  });

  if (compress) {
    // Convert to the minimal possible format
    if (subcommands.length === 1) {
      return subcommands[0];
    } else {
      return [subcommands];
    }
  } else {
    return subcommands;
  }
}
  
  
function copyObjectWithSortedKeys(object) {
  if (isPlainObject(object)) {
    var newObj = {};
    var keysSorted = Object.keys(object).sort();
    var key;
    for (var i in keysSorted) {
      key = keysSorted[i];
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        newObj[key] = copyObjectWithSortedKeys(object[key]);
      }
    }
    return newObj;
  } else if (Array.isArray(object)) {
    return object.map(copyObjectWithSortedKeys);
  } else {
    return object;
  }
}


//from npm extend
function isPlainObject(obj) {
  var hasOwn = Object.prototype.hasOwnProperty;
  var toString = Object.prototype.toString;

  if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval)
    return false;

  var has_own_constructor = hasOwn.call(obj, 'constructor');
  var has_is_property_of_method = hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
  // Not own constructor property must be Object
  if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
    return false;

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.
  var key;
  for ( key in obj ) {}

  return key === undefined || hasOwn.call( obj, key );
};


var dateAsIso8601 = (function () {
  function pad(n) {
    return (n < 0 || n > 9 ? "" : "0") + n;
  }

  return function dateAsIso8601() {
    var date = new Date();
    return date.getUTCFullYear() + "-"
      + pad(date.getUTCMonth() + 1) + "-"
      + pad(date.getUTCDate()) + "T"
      + pad(date.getUTCHours()) + ":"
      + pad(date.getUTCMinutes()) + ":"
      + pad(date.getUTCSeconds()) + ".000Z";
  };
})();



  

/***** blob client methods ****/


//blob object class
module.exports.Blob = BlobObj

//get ripple name for a given address 
module.exports.getRippleName = function (url, address, fn) {
  
  if (!crypt.isValidAddress(address)) return fn (new Error("Invalid ripple address"));
  $.ajax({ 
    url : url + '/v1/user/' + address,
    dataType : 'json',
    success : function (data) {
      if (data.username) return fn(null, data.username);
      else if (data.exists === false) return fn (new Error("No ripple name for this address"));
      else return fn(new Error("Unable to determine if ripple name exists"));
    },
    error : function (err) {
      return fn(new Error("Unable to access vault sever"));
    }
  });
} 

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
 * @param {function} fn
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
  