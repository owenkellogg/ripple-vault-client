var assert = require('assert');

var VaultClient = require('../src');

// XXX Should be actual Blob class
var Blob = function () {};

// XXX Should perhaps use ripple-lib's Hash256.is_valid()
var regexHash256 = /^[0-9a-f]{64}$/i;

// XXX This is 100% bogus data
var exampleData = {
  id: "984a644ec3b56d32b0404777e1eb73390c4b0742a6a0e183f07861056b6746de",
  crypt: "29a0c8b471a52aefef7dc5069eec914d9a42f7b16ce4b22cb6263e39f238f867",
  unlock: "a50ab289b4d533ae1417250187135abbe89d6e85858b08fe655a24cdf148657d",
  encrypted_secret : "AGTGz8DHWnf9jsPbTjEQrcQnFKoTypVP7IxpUGDu0XynYpmR6JSZQl9uotFqrL",
  username : "username",
  password : "password",
  domain   : "staging.ripple.com"
};

describe('VaultClient', function() {
  var vaultClient;

  beforeEach(function() {
    vaultClient = new VaultClient({ domain: exampleData.domain });
  });

  describe('initialization', function() {
    it('should be initialized with a domain', function() {
      var vaultClient = new VaultClient({ domain: exampleData.domain });
      assert.strictEqual(vaultClient.domain, exampleData.domain);
    });

    it('should default to ripple.com without a domain', function() {
      var vaultClient = new VaultClient();
      assert.strictEqual(vaultClient.domain, 'ripple.com');
    });
  });

  describe('#login', function() {
    it('with username and password should retrive the blob, crypt key, and id', function(done) {
      vaultClient.login(exampleData.username, exampleData.password, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'object');

        assert(resp.blob instanceof Blob);

        assert.equal(typeof resp.keys, 'object');
        assert.equal(typeof resp.keys.id, 'string');
        assert(regexHash256.test(resp.keys.id));
        assert.equal(typeof resp.keys.crypt, 'string');
        assert(regexHash256.test(resp.keys.crypt));

        // This should be the actual username (non-normalized) that the user
        // entered during registration.
        //
        // For example, the user might register as "Bob", but login using "bob"
        // which works fine thanks to normalization. However the UI should show
        // him as "Bob" which is why the identity API returns the canonical
        // username as stored in the vault.
        assert.equal(typeof resp.username, 'string');

        done();
      });
    });
  });

  describe('#relogin', function() {
    it('should retrieve the decrypted blob with id and crypt key', function(done) {
      vaultClient.relogin(exampleData.id, exampleData.crypt, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'object');
        assert(resp.blob instanceof Blob);
        done();
      });
    });
  });

  describe('#unlock', function() {
    it('should access the wallet secret using encryption secret, username and password', function(done) {
      vaultClient.unlock(exampleData.username, exampleData.password, exampleData.encrypted_secret, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'object');
        assert.equal(typeof resp.keys, 'object');
        assert.equal(typeof resp.keys.unlock, 'string');
        assert(regexHash256.test(resp.keys.unlock));
        done();
      });
    });
  });

  describe('doing it all in one step', function() {
    it('should get the account secret and address given name and password', function(done) {
      vaultClient.loginAndUnlock(exampleData.username, exampleData.password, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'object');

        assert(resp.blob instanceof Blob);

        assert.equal(typeof resp.keys, 'object');
        assert.equal(typeof resp.keys.id, 'string');
        assert(regexHash256.test(resp.keys.id));
        assert.equal(typeof resp.keys.crypt, 'string');
        assert(regexHash256.test(resp.keys.crypt));
        assert.equal(typeof resp.keys.unlock, 'string');
        assert(regexHash256.test(resp.keys.unlock));

        assert.equal(typeof resp.username, 'string');
        done();
      });
    });
  });
});
