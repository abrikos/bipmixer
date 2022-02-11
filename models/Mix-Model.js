import mongoose from "mongoose";

const schema = new mongoose.Schema({
    to: {type: String, unique: true, trim: true, required: 'Address TO is required',},
    from: {type: String, unique: true, trim: true, required: 'Address FROM is required',},
}, {
    timestamps: {createdAt: 'createdAt'},
    toObject: {virtuals: true},
    toJSON: {virtuals: true}
})


export default mongoose.model('mix', schema)
