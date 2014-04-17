var assert = require('assert');

var VaultClient = require(__dirname + '/../');

describe('Ripple Vault Client', function(){

  beforeEach(function() {

    vaultClient = new VaultClient();

  });

  describe('initialization', function() {

    it('should be initialized with a domain', function() {

      var vaultClient = new VaultClient({ domain: 'zenlabs.co' });
      assert.strictEqual(vaultClient.domain, 'zenlabs.co');

    });

    it('should default to ripple.com without a domain', function() {

      var vaultClient = new VaultClient();
      assert.strictEqual(vaultClient.domain, 'ripple.com');

    });

  });

  describe('#login', function() {

    it('with username and password should retrive the blob, crypt key, and id', function(fn) {

      vaultClient.login('username', 'password', function(err, resp) {

        assert('id' in resp);
        assert('cryptKey' in resp);
        assert(!err);
        fn();

      });

    });

  });

  describe('#relogin', function() {

    it('should retrieve the decrypted blob with id and crypt key', function(fn) {

      vaultClient.relogin('id', 'cryptKey', function(err, resp) {

        assert('blob' in resp);
        assert(!err);
        fn();

      });


    });

  });

  describe('#unlock', function() {

    it('should access the wallet secret using encryption secret, username and password', function(fn) {

      vaultClient.unlock('username', 'password', 'encryptSecret', function(err, resp) {

        assert('wallet' in resp);
        assert('secret' in resp.wallet);
        assert(!err);
        fn();

      });

    });

  });

  describe('doing it all in one step', function() {

    it('should get the account secret and address given name and password', function(fn) {

      vaultClient.loginAndUnlock('username', 'password', function(err, resp) {

        assert('wallet' in resp);
        assert('address' in resp.wallet);
        assert('secret' in resp.wallet);
        assert(!err);
        fn();

      });

    });

  });

});
