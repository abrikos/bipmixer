import mongoose from "mongoose";

const schema = new mongoose.Schema({
    number: Number,
    network: String,
}, {
    timestamps: {createdAt: 'createdAt'},
    toObject: {virtuals: true},
    toJSON: {virtuals: true}
})


export default mongoose.model('block', schema)
