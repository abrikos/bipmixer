import mongoose from "mongoose";

const schema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
    network: String,
    address: {type: String, unique: true, trim: true, required: 'Wallet is required',},
    mnemonic: {type: String, unique: true, trim: true, required: 'Wallet is required',},
}, {
    timestamps: {createdAt: 'createdAt'},
    toObject: {virtuals: true},
    toJSON: {virtuals: true}
})

schema.virtual('txsIn', {
    ref: 'transaction',
    localField: 'address',
    foreignField: 'to',
    // options:{match:{paymentTx:null}},
    // justOne: false
});

schema.virtual('txsOut', {
    ref: 'transaction',
    localField: 'address',
    foreignField: 'from',
    // options:{match:{paymentTx:null}},
    // justOne: false
});

schema.virtual('balance')
    .get(function () {
        const income = this.txsIn ? this.txsIn.map(t => t.value).reduce((a, b) => a + b, 0) : NaN;
        const outcome = this.txsOut ? this.txsOut.map(t => t.value).reduce((a, b) => a + b, 0) : NaN;
        return income - outcome
    });

export default mongoose.model('wallet', schema)
