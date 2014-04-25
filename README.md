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
      #loginAndUnlock
        ✓ should get the decrypted blob and decrypted secret given name and password 


    Blob
      #set
        ✓ should set a new property in the blob
      #extend
        ✓ should extend an object in the blob 
      #unset
        ✓ should remove a property from the blob 
      #unshift
        ✓ should prepend an item to an array in the blob 
      #filter
        ✓ should find a specific entity in an array and apply subcommands to it 
      #consolidate
        ✓ should consolidate and save changes to the blob               
        
## Vault Client Usage

    vaultClient = new VaultClient(domain);

    vaultClient.login(username, password, callback);

    vaultClient.relogin(id, cryptKey, callback);

    vaultClient.unlock(username, password, encryptSecret, callback);

    vaultClient.loginAndUnlock(username, password, callback);
    
    vaultClient.exists(username, callback);
    
    vaultClient.register(options, callback);
    

# Blob Client Methods
    
    blobClient.get(url, id, crypt, callback);
    
    blobClient.create(options, callback);
    
    blobClient.verify(url, username, token, callback);
    

# Blob Methods
    
    blob.encrypt();
    
    blob.decrypt(encryptedBlob);
    
    blob.encryptSecret(encryptionKey);
    
    blob.decryptSecret(encryptionKey, secret);
    
    blob.set(pointer, value, callback);
    
    blob.unset(pointer, callback);
    
    blob.extend(pointer, value, callback);
    
    blob.unshift(pointer, value, callback);
    
    blob.filter(pointer, field, value, subcommands, callback);
    
    
## Installation

    npm install ripple-vault-client


