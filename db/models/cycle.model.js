const mongoose = require('mongoose');

const CycleSchema = new mongoose.Schema({
    cycleDuration: {
        type: String,
        trim: true,
        required: true
    },
    cycleAmount: {
        type: Number,
        trim: true,
        required: true
    },
    cycleStartDate: {
        type: Date,
    },
    wallet: {
        type: Array
    },
    _userId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    frequency: {
        type: String,
        required: true
    }
})

CycleSchema.statics.getWalletSize = () => {
    let user = this;
    return user
}

const cycle = mongoose.model('cycle', CycleSchema);

module.exports = { cycle }