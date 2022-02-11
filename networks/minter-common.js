import axios from "axios";
import {Minter, prepareSignedTx, prepareTx, TX_TYPE} from "minter-js-sdk";
import {generateWallet, walletFromMnemonic} from 'minterjs-wallet';

const util = require("minterjs-util");

export default function (network) {
    return {
        network,
        adaptTx(tx) {
            return {
                network: network.name,
                to: tx.data.to,
                value: this.fromPip(tx.data.value),
                coin: tx.data.coin.symbol,
                ...tx
            }
        },
        async walletFromMnemonic(mnemonic) {
            return walletFromMnemonic(mnemonic)
        },

        checkAddress(address) {
            return /^Mx[a-fA-F0-9]{40}$/.test(address)
        },

        async get(url) {
            const res = await axios.get(url);
            return res.data;
        },

        async getLastBlock() {
            const res = await this.get(`${network.nodeApi}/status`);
            return res.latest_block_height * 1;
        },

        async getTransactions(last, current) {
            const txs = [];
            for (let block = last * 1; block <= current * 1; block++) {
                const res = await this.get(`${network.nodeApi}/block/${block}`)
                if (!res) return [];
                txs.push(...res.transactions.filter(t => t.type === 1));
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

        newWallet() {
            const w = generateWallet();
            // const balance = await this.walletBalance(w.getAddressString())
            return {address: w.getAddressString(), mnemonic: w.getMnemonic(), network: network.name}
        },

        async walletMoveFunds(wallet, to) {
            const res = await this.get(network.nodeApi + '/address/' + this.addressFromSeed(wallet.seedPhrase))
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

        sendTx({txParams, seedPhrase}) {
            return new Promise(async (resolve, reject) => {
                const address = this.walletFromMnemonic(seedPhrase).getAddressString();
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
                    this.get(network.nodeApi + '/send_transaction/' + tx)
                        .then(resolve)
                        .catch(reject)
                } catch (e) {
                    reject(e)
                }
            })

        },

        async getNonce(address) {
            const res = await this.get(`/address/${address}`)
            return res.transaction_count * 1 + 1;
        },
    }
}
