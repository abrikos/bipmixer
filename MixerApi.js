import * as Mongoose from './models';
import CryptoApi from "./CryptoApi";


const obj = {
    usePayload: true,
    foo() {

    },

    async createAddressForMixing(to) {
        return new Promise((resolve, reject) => {
            if (!CryptoApi.checkAddress(to)) return reject({message: 'Invalid address'})
            CryptoApi.newWallet('mixer', to)
                .then(async w => {
                    const {address} = w;
                    const data = {
                        address,
                        min: this.mixerFee * 2 + 1,
                        max: await this.totalAmount()
                    }
                    resolve(data)
                })
        });
    },
    mixerFee: process.env.MIXER_FEE * 1 || 10,
    async calculateMix(value) {
        const txParams = await this.createMix({
            address: 'Mxe43ac6c88f573a7703fe7f2c3d8d342818e8fb97',
            to: 'Mx111ac6c88f573a7703fe7f2c3d8d342818e8fb97',
        }, value)

        const commission = await CryptoApi.getTxParamsCommission();
        //console.log('zzzzzzzzzzz', txParams.map(t => t.value).reduce((a, b) => a + b, 0), commission)
        const total = await this.totalAmount();
        const data = {
            balance: txParams.map(t => t.value).reduce((a, b) => a + b, 0) - commission * txParams.length - this.mixerFee,
            count: txParams.length,
            value: value * 1,
            commission,
            total
        }
        console.log(total, data.value, this.mixerFee, data.commission, data.count)
        return new Promise((resolve, reject) => {
            if (total < data.value - this.mixerFee - data.commission * data.count) reject({message: `Your sum greater than maximum amount ${total} BIP`})
            resolve(data)
        });


    },

    async moveToMixerWallet() {
        const walletForMix = await Mongoose.wallet.find({
            type: 'mixer',
            user: null,
            to: {$ne: null},
            balanceReal: {$gt: 2}
        });
        for (const w of walletForMix) {
            CryptoApi.walletMoveFunds(w, process.env.MIXER_WALLET).then(this.foo).catch(this.foo);
        }
    },

    async moveToMainWallet() {
        CryptoApi.walletMoveFunds({seedPhrase: process.env.MIXER_SEED}, process.env.MAIN_WALLET).then(this.foo).catch(this.foo);
    },

    async checkTransaction(tx) {
        //if(tx.value <=     this.mixerFee * 1 + 1) return console.log('DONATE', tx.hash, tx.value,     this.mixerFee + 1);
        const found = await Mongoose.payment.findOne({tx: tx.hash});
        if (found) return;
        const walletForMix = await Mongoose.wallet.findOne({
            type: 'mixer',
            to: {$ne: null},
            address: tx.to
        });
        if (!walletForMix) return;
        console.log('TX form Mixer wallet', walletForMix.address, 'User', walletForMix.user)
        walletForMix.balance = await CryptoApi.walletBalance(walletForMix.address);
        console.log('New balance', walletForMix.balance)
        walletForMix.save();
        if (walletForMix.user) return;
        Mongoose.transaction.create(tx).catch(console.log)

        const mixes = await this.createMix(walletForMix, CryptoApi.fromPip(tx.data.value));
        const mixSum = mixes.map(m => m.value).reduce((a, b) => a + b, 0)
        const list = [];
        for (const m of mixes) {
            const value = m.value - this.mixerFee * m.value / mixSum;
            console.log(value, this.mixerFee * m.value / mixSum)
            CryptoApi.fromWalletToAddress(m.from, walletForMix.to, value)
            list.push({coin: 0, to: m.from.address, value: m.value})
        }
        const txParams = {
            data: {list}
        }
        console.log(list)
        CryptoApi.sendTx({txParams, seedPhrase: process.env.MAIN_SEED})

    },

    async createMix(walletForMix, receivedValue) {
        if (receivedValue < this.mixerFee || !walletForMix.to) return [];
        const wallets = await this.getWalletsForPayments(walletForMix.address, receivedValue);
        let sum = 0;
        const singleSends = [];
        for (const from of wallets.res) {
            let value = receivedValue * from.balance / wallets.sum;
            if (value > from.balance) value = from.balance;
            //console.log(value, from.balance, from.address)
            //if wallet.to - wallet created for mixing
            if (sum < receivedValue) {
                //const payment = new Mongoose.payment({from, list: [{to: wallet.to, value}]});
                const mixer = {value, from};
                if (mixer.value > 0) singleSends.push(mixer)
                sum += value;
            }
        }
        return singleSends;
    },

    async totalAmount() {
        const res = await Mongoose.user.find({balance: {$gt: 0}, coin: CryptoApi.network.coin});
        //const main = await CryptoApi.walletBalance(process.env.MAIN_WALLET);
        return res.reduce((n, {balance}) => n + balance, 0);
    },


    async getWalletsForPayments(address, value) {
        const wallets = await Mongoose.wallet.find({type: 'mixer', balanceReal: {$gt: 2}, address: {$ne: address}})
            .sort({balance: -1});
        let sum = 0;
        let res = [];
        for (const w of wallets) {
            sum += w.balance;
            res.push(w)
            if (value < sum && res.length > 2) {
                return {res, sum};
            }
        }
        return {res, sum};
    },


}
export default obj;
