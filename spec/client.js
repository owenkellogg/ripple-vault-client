var assert      = require('assert');
var VaultClient = require('../src');
var Blob        = require('../src/blob').Blob;

// XXX Should perhaps use ripple-lib's Hash256.is_valid()
var regexHash256 = /^[0-9a-f]{64}$/i;

// XXX This is 100% bogus data
var exampleData = {
  id       : "9236cd8a9cc7f909633d7bb55effd0bd389d67d9ec1a6057bc47dfd813cbcc50",
  crypt    : "d8c65bf04f29d2bcf2f183f9f70efe03c5cb47dda049c4809ec9cb7d6ac428fd",
  unlock   : "452b02b80469a6a2ad692264c04d2a3794ea0ab11d8c902ef774190294db2ce2",
  blobURL  : "http://curlpaste.com:8080",
  username : "testUser",
  password : "testPassword",
  domain   : "curlpaste.com",
  encrypted_secret : "ABVznT3ENq04CGtJWQWXaNIIPPTeNi8OctPUcBzU67tQXiiVKvfgjKfRF4+/zWTLdzxgJ002"
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
  
  describe('#exists', function() {
    it('should determine if a username exists on the domain', function(done) {
      this.timeout(10000);
      vaultClient.exists(exampleData.username, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'boolean');
        done();
      });
    });
  });
  
  describe('#login', function() {
    it('with username and password should retrive the blob, crypt key, and id', function(done) {
      this.timeout(10000);
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
    it('should retrieve the decrypted blob with blob vault url, id, and crypt key', function(done) {
      this.timeout(10000);
      vaultClient.relogin(exampleData.blobURL, exampleData.id, exampleData.crypt, function(err, resp) {
        assert.ifError(err);
        assert.equal(typeof resp, 'object');
        assert(resp.blob instanceof Blob);
        done();
      });
    });
  });

  describe('#unlock', function() {
    it('should access the wallet secret using encryption secret, username and password', function(done) {
      this.timeout(10000);
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

  describe('#loginAndUnlock', function() {
    it('should get the decrypted blob and decrypted secret given name and password', function(done) {
      this.timeout(10000);
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


describe('Blob', function() {
  var vaultClient;
  
  vaultClient = new VaultClient({ domain: exampleData.domain });
  vaultClient.login(exampleData.username, exampleData.password, function(err,resp){
    assert.ifError(err);
    var blob = resp.blob;


    describe('#set', function() {
      it('should set a new property in the blob', function(done) {
        this.timeout(10000)
  
        blob.extend("/testObject", {
          foo    : [],
        }, function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          done();
        });
      });
    }); 
    
    describe('#extend', function() {
      it('should extend an object in the blob', function(done) {
        this.timeout(10000)
  
        blob.extend("/testObject", {
          foobar : "baz",
        }, function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          done();
        });
      });
    }); 

    describe('#unset', function() {
      it('should remove a property from the blob', function(done) {
        this.timeout(10000)
  
        blob.unset("/testObject", function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          done();
        });
      });
    }); 
        
    describe('#unshift', function() {
      it('should prepend an item to an array in the blob', function(done) {
        this.timeout(10000)
  
        blob.unshift("/testArray", {
          name    : "bob",
          address : "1234"
        }, function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          done();
        });
      });
    });
    
    describe('#filter', function() {
      it('should find a specific entity in an array and apply subcommands to it', function(done) {
        this.timeout(10000)
  
        blob.filter('/testArray', 'name', 'bob', 'extend', '', {description:"Alice"}, function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          done();
        });
      });
    });    

    describe('#consolidate', function() {
      it('should consolidate and save changes to the blob', function(done) {
        this.timeout(10000)
  
        blob.consolidate(function(err, resp){
          assert.ifError(err);
          assert.equal(resp.result, 'success');
          blob.unset('/testArray'); //remove all
          done();
        });
      });
    });    
  });
});  
