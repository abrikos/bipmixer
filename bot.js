import 'dotenv/config'
import BotApi from './BotApi';
import * as Networks from './networks';
import * as Mongoose from './models';

const TelegramBot = require('node-telegram-bot-api');


// Mongoose.block.deleteMany(console.log)
//Mongoose.user.deleteMany(console.log)
//Mongoose.transaction.deleteMany(console.log)
// console.log(Object.values(Networks).map(n=>n.network))
for (const net of Object.keys(Networks)) {
    let timer;
    setInterval(async () => {
        if (timer) return;
        timer = true;
        // console.time('Start timer')
        try {
            const network = Networks[net].network.name;
            const current = await Networks[net].getLastBlock();
            let last = await Mongoose.block.findOne({network});
            if (!last) {
                last = await Mongoose.block.create({network, number: current})
            }
            const txs = await Networks[net].getTransactions(last.number, current);
            // console.log(last.number, current, txs)
            for (const tx of txs) {
                const transaction = Networks[net].adaptTx(tx);
                const found = await Mongoose.wallet.findOne({network, address: transaction.to});
                console.log(found, network);
                if (!found) continue;
                Mongoose.transaction.create(Networks[net].adaptTx(tx)).catch(e => console.log(e.message));
            }
            last.number = current;
            await last.save()
        } catch (e) {
            console.log(e)
        }

        timer = false;
        // console.timeEnd('Start timer')

    }, 5000)
}

//Mongoose.wallet.find().populate(['txsIn', 'txsOut']).then(console.log)

const options = {polling: true,};

const bot = new TelegramBot(process.env.BOT_TOKEN, options);
const commands = Object.keys(BotApi.commands).map(k => ({command: k, description: BotApi.commands[k].description}));
bot.setMyCommands(commands);

bot.on('message', async (msg) => {
    console.log(msg)
    const chatId = msg.chat.id;
    const {messages, menu} = await BotApi.prepareReply(msg);
    for (const m of messages) {
        await bot.sendMessage(chatId, m, {parse_mode: "Markdown"})
    }
    if (menu)
        bot.sendMessage(chatId, 'Menu', {reply_markup: {inline_keyboard: menu}})

});

bot.on('callback_query', async (callbackQuery) => {
    console.log(callbackQuery)
});
