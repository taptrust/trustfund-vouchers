const HDWalletProvider = require("truffle-hdwallet-provider-privkey");

/*
  https://ethereum.stackexchange.com/a/50038
  
  Use this to fix issues with nonce being too low
*/
const NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker")

const infura_apikey = "155f5547dd0e4ab09bded202e8bcc08a";
const private_key = "943eed2a06c4ba5991cf724ead779bebca00a7e47d3f29a2a334c7447a763b95";

require('babel-register');
require('babel-polyfill');


module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas:   10000000
    },
    ropsten: {
      provider: function() {
        const wallet = new HDWalletProvider([private_key], "https://ropsten.infura.io/v3/"+ infura_apikey);
        var nonceTracker = new NonceTrackerSubprovider()
        wallet.engine._providers.unshift(nonceTracker)
        nonceTracker.setEngine(wallet.engine)
        return wallet
      },
      network_id: 3,
      gas:   7900000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};