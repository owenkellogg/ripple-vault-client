
function VaultClient(opts) {
  if (!opts) { opts = {}; };
  this.domain = opts.domain || 'ripple.com';
};

VaultClient.prototype.login = function(username, password, fn) {

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

