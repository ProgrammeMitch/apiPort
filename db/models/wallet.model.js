const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
    walletId: {
        type: String,
        required: true,
        minlength: 1,
        trim: true
    },
    walletAmount: {
        type: Number,
        trim: true
    },
    cycle: {
        type: Array
    },
    _userId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    transactions: {
        type: []
    }
})

const wallets = mongoose.model('wallets', WalletSchema);

module.exports = { wallets }