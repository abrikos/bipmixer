import * as Networks from "./networks";
import MixerApi from "./MixerApi";
import * as Mongoose from './models';

//Mongoose.user.cleanIndexes().then(console.log)

const BotApi = {
    commands: {
        help: {
            description: 'Help about the bot',
            messages() {
                return [
                    'Accepted inputs:',
                    '<Mx...> - the address to which the mix will be received. Result: the address to which you want to send the amount for the mix.',
                    '<any number> - the amount has been sent to the mixer address. Result: calculation of the amount received to the source address.',
                ]
            }
        },
        menu: {
            description: 'Main menu',
            messages() {
                return [];
            },
            menu: [
                [{text: ('My referral link'), callback_data: 'cabinet@reflink'},],
                [{text: ('My referral addresses'), callback_data: 'cabinet@addresses'},],
                [
                    {text: ('Referrals'), callback_data: 'cabinet@referrals'},
                    {text: ('Bets'), callback_data: 'cabinet@bets'},
                ],
                [{text: ('Back'), callback_data: 'home@start'},]
            ]
        },
        wallet: {
            description: 'Your wallet to participate in receiving interest from mixing',
            async messages(msg) {
                try {
                    let user = await Mongoose.user.findOne({user: msg.from.id})
                    const messages = ['Your wallets']
                    if (!user) {
                        user = await Mongoose.user.create({user: msg.from.id})
                        for (const net of Object.keys(Networks)) {
                            const wallet = Networks[net].newWallet();
                            await Mongoose.wallet.create({user, ...wallet})
                        }
                    }
                    const wallets = await Mongoose.wallet.find({user}).populate(['txsIn', 'txsOut']);
                    for (const wallet of wallets) {
                        const network = Object.values(Networks).map(n => n.network).find(n => n.name === wallet.network)
                        if (!network) continue;
                        messages.push(`${network.label}:`)
                        messages.push(`*${wallet.address}*`)
                        messages.push(`Balance: *${wallet.balance}* ${network.coin}`)
                    }
                    return messages
                } catch (e) {
                    console.log(e)
                }
            }
        }
    },
    async prepareReply(msg) {
        const {text} = msg;
        const match = text.match(/\/([a-z_]+)/);
        if (match && this.commands[match[1]]) {
            return {messages:this.commands[match[1]].messages(msg), menu:this.commands[match[1]].menu}
        } else if (CryptoApi.checkAddress(text)) {
            return this.doAddress(text)
        } else if (text * 1 > 0) {
            return this.doCalculateSum(text)
        } else {
            return ['Wrong request. Please /help']
        }

    },

    async doAddress(text) {
        try {
            const messages = []
            const data = await MixerApi.createAddressForMixing(text)
            messages.push(`To receive mixed BIPs please send from *${data.min}* BIP to *${data.max.toFixed(0)}* BIP to address:`)
            messages.push(`*${data.address}*`)
            return messages;
        } catch (e) {
            console.log(e)
        }
    },

    async doCalculateSum(text) {
        try {
            const calc = await MixerApi.calculateMix(text)
            const messages = []
            messages.push(`Maximum amount for mix *${calc.total}* BIP`)
            messages.push(`If you send ${calc.value} BIP will be received: *${calc.balance.toFixed(2)} BIP*`)
            messages.push(`     mixer commission: ${CryptoApi.params.mixerFee} BIP,`)
            messages.push(`count of transactions: ${calc.count}`)
            return messages;
        } catch (e) {
            console.log(e)
        }
    },


    doHelp() {
        return [
            'Accepted inputs:',
            '<Mx...> - the address to which the mix will be received. Result: the address to which you want to send the amount for the mix.',
            '<any number> - the amount has been sent to the mixer address. Result: calculation of the amount received to the source address.',
        ]
    },

}
export default BotApi;
