import mongoose from "mongoose";

const schema = new mongoose.Schema({
    user: Number,
    username: String,
    first_name: String,
    last_name: String,
}, {
    timestamps: {createdAt: 'createdAt'},
    toObject: {virtuals: true},
    toJSON: {virtuals: true}
})

schema.virtual('wallets', {
    ref: 'wallet',
    localField: '_id',
    foreignField: 'user',
    // options:{match:{paymentTx:null}},
    // justOne: false
});


export default mongoose.model('user', schema)
