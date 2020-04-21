// FOR WALLET balance

exports.setWalletTokenBalUSDT = function() {
  currency.findOne({ "status": 1, "type":"erc20", "contract_address":{$ne: ""}}).exec(function(err, resUpdate){
    var adminAddr = endecrypt.decrypt(coinAddr.eth.address);
    var contract_address = resUpdate.contract_address;
    var decimal = resUpdate.decimal; 
    var getDecimals = decimal + 1;
    var decimals = '1'.padEnd(getDecimals,0);
    console.log('decimals',decimals);
    var symbol = resUpdate.symbol;
      getJSON("https://ropsten.etherscan.io/api?module=account&action=tokenbalance&contractaddress="+contract_address+"&address="+adminAddr+"&tag=latest&apikey=YHCRADAWH9Q2RA17SDGZ2DC9UCD3K5NV7H", function (errorBal, tokenBal) {
        if (!errorBal && tokenBal) {
          var balance = tokenBal.result/+decimals;
          console.log(balance);
          currency.findOneAndUpdate({ "symbol": symbol},{ "$set": {"extrakey":+balance} },{multi: true}).exec(function(err, resUpdate){ });     
        }
      });
  });
}
// FOR WALLET balance

// CRON
  
  function EthToken_AdminTransfer(data) {
  console.log('data');
  var currency = data.symbol;
  var contract_address = data.contract_address;
  var decimal = data.decimal; 
  var getDecimals = decimal + 1;
  var decimals = '1'.padEnd(getDecimals,0);
  var adminAddr = endecrypt.decrypt(coinAddr.eth.address);
  var userKey = endecrypt.decrypt(jsonrpc.eth.userKey);

  deposit.find({ "currency": currency, 'move_status': 0}).exec(function (err_find, resData_find) {
    if(resData_find.length > 0) {
      for (var i = 0; i < resData_find.length; i++) {
        (function (iCopy) {
          var val = resData_find[iCopy];
          var account = val.crypto_address;
          var depositId = val._id;
          var amount = val.amount;
          var user_id = val.user_id;
          // user token bal
          getJSON("https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress="+contract_address+"&address="+account+"&tag=latest&apikey=YHCRADAWH9Q2RA17SDGZ2DC9UCD3K5NV7H", function (errorBal, tokenBal) {
            if (!errorBal && tokenBal) {
              var bal = tokenBal.result;
              var userBal = bal/+decimals;
              console.log('usdt',userBal)
              if(userBal > 0) {
                // user eth bal                
                getJSON("https://api.etherscan.io/api?module=account&action=balance&address="+account+"&tag=latest&apikey=YHCRADAWH9Q2RA17SDGZ2DC9UCD3K5NV7H", function (error, ethApiBal) {
                  if(!error && ethApiBal){
                  console.log('error',error,ethApiBal);
                  var ethBal = ethApiBal.result / 1000000000000000000;
                  console.log('ethBal',ethBal);
                  var ethFee = 0.004;
                  if (val.fee_status == 0 && (0 == ethBal || ethBal < ethFee)) {
                    var objData = { 'currency':'eth', 'userAddr': account, 'amount': ethFee };
                    console.log('objData',objData);
                    common.releaseCoin(objData,function(txn){
                      console.log('txn',txn)
                      if(txn > 0) {
                        deposit.updateOne({_id : depositId},{"$set" : { fee_status : 1 }}).exec(function(updateError,updateRes) {})
                        
                        var payments = {
                          "user_id": mongoose.mongo.ObjectId(user_id),
                          "crypto_address": account,
                          "amount": +ethFee,
                          "currency": currency,
                          "txnid": txn,
                          "admin_token":1,
                          "move_status":1,
                          "status": "completed"
                        };
                        deposit.create(payments, function (dep_err, dep_res) { });
                      }
                    })
                  } 
                  else {
                    console.log('-------------else----------------');
                    var Client = require('node-rest-client').Client;
                    var client = new Client();
                    var host = endecrypt.decrypt(jsonrpc.eth.host);                    
                    var port = jsonrpc.eth.port;
                    var url = "http://"+host+":"+port;
                    var hexAmount = converter.decToHex(tokenBal.result+'');
                    var hexAmt = hexAmount.substr(2);
                    var amt = hexAmt.padStart(64, '0');
                    var hexAcc = adminAddr.substr(2);
                    var input = '0xa9059cbb000000000000000000000000'+hexAcc+amt; // methd+adminadd+amt
                     console.log('-------------else----------------',input);
                    let gasPrice = '30000000000';
                    let gasLimit = '100000';
                    gasPrice = converter.decToHex(gasPrice);
                    gasLimit= converter.decToHex(gasLimit);

                    var unlock = {
                      data: { "jsonrpc": "2.0", "method": "personal_unlockAccount", "params": [account,userKey, null], "id": 1 },
                      headers: {
                        "Content-Type": "application/json;charset=utf-8"
                      }
                    };

                    client.post(url, unlock, function (unlockData) {
                      console.log('unlockData',unlockData);
                      if(unlockData.result) {
                        var output = {
                          data: { "jsonrpc": "2.0", "method": "eth_sendTransaction", "params": [{"from":account ,"to": contract_address,"gas": gasLimit ,"gasPrice": gasPrice,"data": input }], "id": 22 },
                          headers: {
                            "Content-Type": "application/json;charset=utf-8"
                          }
                        };
                        client.post(url, output, function (outData) {
                          console.log('--------------outData-------------',outData)
                          if(outData.result) {
                            console.log('--------------move_status-------------');
                            deposit.updateOne({_id : depositId},{"$set" : { move_status : 1}}).exec(function(updateError,updateRes) { 
                              console.log('--------------updateRes-------------',updateRes,updateError);
                            })
                          }
                        })
                      }
                    })
                  }
                }
                })
              }
            }
          });
        }(i))
      }
    }
  });
}


// CRON
