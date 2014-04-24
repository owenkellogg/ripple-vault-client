ripple-vault-client
===================

A javascript / http client to interact with Ripple Vault servers.

The purpose of this tool is to enable applications in any javascript
environment to login with the ripple vault and access the decrypted
data stored using credentials originally obtained at ripple.com

## Spec Tests

Run `npm test` to test the high-level behavior specs 

    Ripple Vault Client
      initialization
        ✓ should be initialized with a domain 
        ✓ should default to ripple.com without a domain 
      #login
        ✓ with username and password should retrive the blob, crypt key, and id 
      #relogin
        ✓ should retrieve the decrypted blob with id and crypt key 
      #unlock
        ✓ should access the wallet secret using encryption secret, username and password 
      doing it all in one step
        ✓ should get the account secret and address given name and password 

## Usage

    vaultClient = new VaultClient(domain);

    vaultClient.login(username, password, callback);

    vaultClient.relogin(id, cryptKey, callback);

    vaultClient.unlock(username, password, encryptSecret, callback);

    vaultClient.loginAndUnlock(username, password, callback);
    
    vaultClient.exists(username, callback);
    
    vaultClient.register(options, callback);

## Installation

    npm install ripple-vault-client


