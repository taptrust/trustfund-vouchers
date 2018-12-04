
const infura_apikey = "155f5547dd0e4ab09bded202e8bcc08a";
const web3 = new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io/v3/"+ infura_apikey))

const wallet_address = "0x0eEB66338d9672Ba67a4342ECE388E4026f9b43d";
const wallet_private_key = "943eed2a06c4ba5991cf724ead779bebca00a7e47d3f29a2a334c7447a763b95";
const wallet_private_key_buffer = new ethereumjs.Buffer.Buffer(wallet_private_key, "hex")

const voucher_registry_contract_address = "0x93063EF391E6a33879cF3cA9a4B92cCf1EFDe82d";
const voucher_user_contract_address = "0xe957DacBbC9d78502CFde65d5E24131b173869Cc";

let VouchersRegistry = null;
let vouchersRegistryContract = null;

//Load the contract ABI from JSON file, and then create a contract variable pointing to the one on the Ropsten testnet
function loadVouchersRegistry() {
    var xobj = new XMLHttpRequest();

    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'VouchersRegistry.json', false);

    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            VouchersRegistry = web3.eth.contract(JSON.parse(xobj.responseText));
            vouchersRegistryContract = VouchersRegistry.at(voucher_registry_contract_address);
        }
    };
    xobj.send(null);  
}

loadVouchersRegistry();

//Called when Send Transaction button is clicked.
function onSendTransaction(form){
    if(!vouchersRegistryContract) {
        console.log("Error loading contract ABI.");
        return;
    }
   
    const contract = form.elements["contract"].value;
    const value = form.elements["value"].value;
    const redeemablePerUser = form.elements["redeemablePerUser"].value;

    console.log(vouchersRegistryContract)

    try {
        //Get number of transactions sent from the wallet_address to use as the nonce
        web3.eth.getTransactionCount(wallet_address, function(err, txCount) {
            if(err) {
                console.log("Error getting transaction count: " + err);
                return;
            }
            
            const data = vouchersRegistryContract.addContractVouchers.getData(contract, redeemablePerUser);

            const rawTx = {
                nonce: web3.toHex(txCount),
                from: wallet_address,
                to: voucher_registry_contract_address,
                value: web3.toHex(value),
                data: data,
                gas: 200000,
                gasPrice: 50e9,
                chainId: 3
            };

            const signedTx = new ethereumjs.Tx(rawTx);

            signedTx.sign(wallet_private_key_buffer);

            const serializedTx = signedTx.serialize();

            web3.eth.sendRawTransaction("0x" + serializedTx.toString("hex"), function(err, hash)
            {
                if(err) {
                    console.log("Error sending transaction: " + err);
                } else {
                    console.log("Transaction hash: " + hash);
                }
            });

        })
    }
    catch(err) {
        console.log(err)
    }
}
