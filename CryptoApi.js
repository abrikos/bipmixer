import axios from "axios";
import {Minter, prepareSignedTx, prepareTx, TX_TYPE} from "minter-js-sdk";
import {generateWallet, walletFromMnemonic} from 'minterjs-wallet';

const util = require("minterjs-util");
const fs = require('fs');

const networks = {
    BIP: {
        lastBlockEndpoint(){
            return `${this.explorerApi}/status`
        },
        lastBlock(res){
            return  res.latest_block_height * 1
        },
        label:'Minter main network',
        nodeApi: 'https://api.minter.one/v2',
        explorerApi: 'https://explorer-api.minter.network/api/v2',
        coin: 'BIP',
        explorer: 'https://explorer.minter.network/',
        image: 'https://my.minter.network/api/v1/avatar/by/coin/',
        chainId: 1
    },
    MNT: {
        lastBlockEndpoint(){
          return `${this.explorerApi}/status`
        },
        lastBlock(res){
          return  res.latest_block_height * 1
        },
        label:'Minter testnet network',
        nodeApi: 'https://node-api.testnet.minter.network/v2',
        explorerApi: 'https://explorer-api.testnet.minter.network/api/v2',
        coin: 'MNT',
        explorer: 'https://explorer.testnet.minter.network/',
        image: 'https://my.beta.minter.network/api/v1/avatar/by/coin/',
        chainId: 2
    }
}

const obj = {
    divider: 1e18,
    async walletFromMnemonic(seedPhrase) {
        return walletFromMnemonic(seedPhrase)
    },

    checkAddress(address) {
        return /^Mx[a-fA-F0-9]{40}$/.test(address)
    },

    async testWallet() {
        const w = generateWallet();
        const address = w.getAddressString();
        const v = await this.get(`/address/${address}`);
        if (v.bip_value * 1 > 0) {
            console.log('!!!!!!!!!!!!!!!!!!TREASURE!!!!!!!!!!!!!!!!!!!', address)
            fs.appendFileSync('seeds.txt', `${address} - ${this.fromPip(v.bip_value)}\n${w.getMnemonic()}\n\n`);
        }
    },

    async get(url) {
        try{
            const res = await axios.get(url);
            return res.data;
        }catch (e) {
            console.log(e)
        }
    },

    async walletTransactions(address){
        const v = await this.get(`/addresses/${address}/transactions`, true);
        return v.data;
    },

    async walletBalance(wallet) {
        const v = await this.get(`${networks[wallet.network].explorerApi}/address/${wallet.address}`)
        return this.fromPip(v.bip_value) * 1;
    },

    async getLastBlock(net) {
        const res = await this.get(`/status`);
        return res.latest_block_height * 1;
    },

    async getTransactions(last, current) {
        const txs = [];
        for (let block = last * 1; block <= current * 1; block++) {
            const res = await this.get(`/block/${block}`)
            if (!res) return [];
            for (const tx of res.transactions) {
                tx.date = res.time;
                if (!tx.data.list) {
                    tx.to = tx.data.to;
                    tx.value = tx.data.value * 1e-18;
                    tx.coin = tx.data.coin ? tx.data.coin.symbol : '';
                    txs.push(tx)
                } else {
                    const list = [];
                    for (const l of tx.data.list) {
                        const found = list.find(x => x.to === l.to);
                        if (found) {
                            found.value += l.value;
                        } else {
                            list.push(l)
                        }
                    }
                    for (const v of list) {
                        tx.to = v.to;
                        tx.value = v.value * 1e-18;
                        tx.coin = v.coin.symbol;
                        txs.push(tx)
                    }
                }
            }
        }
        return txs;
    },

    toPip(value) {
        return util.convertToPip(value)
    },

    fromPip(value) {
        return (util.convertFromPip(value) * 1).toFixed(3)
    },

    async getTxParamsCommission(txParamsOrig) {
        const txParams = {...txParamsOrig};
        txParams.type = TX_TYPE.SEND;
        if (!txParams.data) {
            txParams.data = {
                coin: 0,
                to: 'Mx389a3ec7916a7c40928ab89248524f67a834eab7',
                value: '100'
            };
        }
        if (txParams.data.list) {
            txParams.type = TX_TYPE.MULTISEND;
        }
        txParams.nonce = 1;
        txParams.chainId = params.network.chainId;
        try {
            const tx = prepareTx({...txParams, signatureType: 1}).serializeToString();
            const res = await this.get('/estimate_tx_commission/' + tx)
            //const res = await  this.get('/price_commissions')
            return this.fromPip(res.commission) * 1 + 1;
        } catch (e) {
            console.log('txParams commission error:', e.message)
        }


        //return minter.estimateTxCommission(txParams)
    },

    async newWallet(network) {
        const w = generateWallet();
        const balance = await this.walletBalance(w.getAddressString())
        return {address: w.getAddressString(), mnemonic: w.getMnemonic(), balance, network}
    },

    async walletMoveFunds(wallet, to) {
        const res = await this.get('/address/' + this.addressFromSeed(wallet.seedPhrase))
        const txParams = {
            type: TX_TYPE.SEND,
            data: {
                list: []
            },
        }
        for (const b of res.balance.sort((a, b) => a.coin.id < b.coin.id)) {
            txParams.data.list.push({
                to,
                value: this.fromPip(b.value),
                coin: b.coin.id
            })
        }
        wallet.txParams = txParams;
        return new Promise((ok, err) => {
            this.sendTx(wallet)
                .then(ok)
                .catch(err)
        })
    },

    async estimateSwap(coin0, coin1, valueToSell, type, swap_from = 'pool') {
        const action = `/estimate_coin_${type}?swap_from=${swap_from}&value_to_${type}=${valueToSell}&coin_to_buy=${coin0}&coin_to_sell=${coin1}`
        return this.get(action);
    },

    async fromWalletToAddress(wallet, address, value) {
        const txParams = {
            type: TX_TYPE.SEND,
            data: {
                to: address,
                value,
                coin: 0
            },
        }
        wallet.txParams = txParams;
        return new Promise((ok, err) => {
            this.sendTx(wallet)
                .then(ok)
                .catch(err)
        })
    },

    async fromMainTo(to, amount) {
        const main = await this.getMainWallet();
        const txParams = {
            type: TX_TYPE.SEND,
            data: {
                to,
                value: amount,
                coin: 0, // coin id
            },
        }
        main.txParams = txParams;
        return new Promise((ok, err) => {
            this.sendTx(main)
                .then(ok)
                .catch(err)
        })
    },

    addressFromSeed(seed) {
        return walletFromMnemonic(seed).getAddressString();
    },

    sendTx({txParams, seedPhrase}) {
        return new Promise(async (resolve, reject) => {
            const address = this.addressFromSeed(seedPhrase);
            const balance = (await this.walletBalance(address)).toFixed(3);
            if (txParams.data.list) {
                txParams.type = TX_TYPE.MULTISEND;
                for (const l of txParams.data.list) {
                    l.coin = l.coin || 0;
                }
            } else {
                txParams.type = TX_TYPE.SEND;
                txParams.data.coin = txParams.data.coin || 0;
            }

            if (txParams.data.list) {
                const mainCoin = txParams.data.list.find(l => l.coin === '0');
                if (mainCoin) {
                    const comm = await this.getTxParamsCommission(txParams);
                    mainCoin.value -= comm;
                }
            } else {
                if (txParams.data.coin === 0) {
                    txParams.data.value -= await this.getTxParamsCommission(txParams);
                }

            }

            if (txParams.data.value <= 0) return console.log(`NEGATIVE value `, txParams.data)
            if (txParams.data.value >= balance)
                return console.log(`INSUFFICIENT ${txParams.data.value} >= ${balance}`);
            txParams.chainId = this.network.chainId;
            txParams.nonce = await this.getNonce(address);
            try {
                const tx = prepareSignedTx(txParams, {seedPhrase}).serializeToString();
                this.get('/send_transaction/' + tx)
                    .then(resolve)
                    .catch(reject)
            }catch (e) {
                reject(e)
            }
        })

    },

    async getNonce(address) {
        const res = await this.get(`/address/${address}`)
        return res.transaction_count * 1 + 1;
    },


    async getMainWallet() {
        return Mongoose.wallet.findOne({address: process.env.MAIN_WALLET})
    },

    async createMainWallet() {
        const d = {address: process.env.MAIN_WALLET}
        const w = await Mongoose.wallet.findOne(d);
        if (!w) {
            d.seedPhrase = process.env.MAIN_SEED;
            d.type = 'mixer';
            Mongoose.wallet.create(d)
        }
    },

    async sendPayments() {
        const payments = await Mongoose.payment.find({status: 0}).populate('fromMultiSend');
        if (!payments.length) return;
        const txs = []
        for (const payment of payments) {
            // create txParams from wallet to address who request mix
            for (const m of payment.singleSends) {
                const txParams = {
                    data: {to: m.to, value: m.value, saveResult: m.saveResult},
                }
                txs.push({txParams, address: m.fromAddress, seedPhrase: m.fromSeed, payment})
            }
            if (payment.fromMultiSend) {
                const txParams = {data: {list: []}}
                //txParams.payload =  'Mixer refunds';
                //Prepare multisend profits (proportional bonus for investors)
                for (const m of payment.multiSends) {
                    txParams.data.list.push(m)
                }
                txs.push({txParams, address: payment.fromMultiSend.address, seedPhrase: payment.fromMultiSend.seedPhrase, payment})
            }
        }

        for (const tx of txs) {
            console.log(tx)
            this.sendTx(tx)
                .then(t => {
                    if (tx.txParams.data.saveResult || tx.txParams.data.list) {
                        tx.payment.results.push({data: tx.txParams.data, hash: t.hash})
                    }
                    tx.payment.status = 1;
                    tx.payment.save().catch(() => {
                    })
                    console.log('transaction complete', t)
                })
                .catch(e => {
                    tx.payment.status = 2;
                    tx.payment.save().catch(() => {
                    })
                    console.log(e.response ? `BLOCKCHAIN ERROR: ${e.response.data.error.message} ` : `NODE ERROR${e.message}`)
                })
        }
    },


}
export default obj;
