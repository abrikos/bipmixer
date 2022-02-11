import moment from "moment";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const name = 'transaction';


const modelSchema = new Schema({
        hash: {type: String, unique:true},
        from: {type: String},
        to: {type: String},
        value: {type: Number},
        coin: {type: String},
        network: {type: String},
        timestamp: {type: String},
        type: {type: Number},
        height: {type: Number},
        data: {type: Object},
        //wallet: {type: mongoose.Schema.Types.ObjectId, ref: 'Wallet'},
    },
    {
        timestamps: {createdAt: 'createdAt'},
        toObject: {virtuals: true},
        // use if your results might be retrieved as JSON
        // see http://stackoverflow.com/q/13133911/488666
        toJSON: {virtuals: true}
    });

modelSchema.statics.add = function (tx){
    this.create({date: moment(tx.timestamp)})
}

modelSchema.virtual('date')
    .get(function () {
        return moment(this.timestamp).format('YYYY-MM-DD HH:mm:ss')
    });



export default mongoose.model(name, modelSchema)


