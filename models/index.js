import mongoose from 'mongoose';
import user from "./User-Model"
import block from "./Block-Model"
import transaction from "./Transaction-Model"
import wallet from "./Wallet-Model"
export {user, transaction, block, wallet}

try {
    mongoose.connect(process.env.MONGODB_URI)
    console.log('Connect MongoDB:', process.env.MONGODB_URI)
} catch (e) {
    console.log('Mongoose error:', e.message)
}

