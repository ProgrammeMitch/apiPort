const mongoose = require('mongoose');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

//JWT Secret
const jwtSecret = 'newsecret';

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        minLength: 1,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minLength: 8
    },
    sessions: [{
        token: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Number,
            required: true
        }
    }],

    //User Information to be patched subsequently

    firstName: {
        type: String,
        minLength: 1,
        trim: true
    },
    lastName: {
        type: String,
        minLength: 1,
        trim: true
    },
    age: {
        type: String,
        minLength: 1,
        trim: true
    },
    occupation: {
        type: String,
        minLength: 1,
        trim: true
    },
    salary: {
        type: String,
        minLength: 1,
        trim: true
    },
    maritalStatus: {
        type: String,
        minLength: 1,
        trim: true
    },
    phoneNumber: {
        type: Number
    },
    bvn: {
        type: Number
    },
    address: {
        type: String,
        minLength: 1,
        trim: true
    },
    accountNumber: {
        type: Number,
        minLength: 1,
        trim: true
    },
    bank: {
        type: String,
        minLength: 1,
        trim: true
    },
    nextOfKinName: {
        type: String,
        minLength: 1,
        trim: true
    },
    nextOfKinPhoneNumber: {
        type: String,
        minLength: 1,
        trim: true
    },
    origin: {
        type: String,
        minLength: 1,
        trim: true
    },
    nin: {
        type: Number
    },
    ninimage: {
        type: String,
        minLength: 1,
        trim: true
    },
    wallet: {
        type: Object
    },
    messages: {
        type: Array
    },
    pendingTransfer: {
        type: Boolean,
        default: false
    }
});


//INSTANCE METHODS
UserSchema.methods.toJSON = function () {
    const user = this;
    const userObject = user.toObject();

    //return the document except the password and sessions
    return _.omit(userObject, ['password', 'sessions'])
}

UserSchema.methods.generateAccessAuthToken = function () {
    const user = this;
    return new Promise((resolve, reject) => {
        //create JSON web token and return it
        jwt.sign({ _id: user._id.toHexString() }, jwtSecret, { expiresIn: "1000s" }, (err, token) => {
            if (!err) {
                resolve(token)
            } else {
                reject()
            }
        })
    })
}

UserSchema.methods.generateRefreshAuthToken = function () {
    //generate a 64byte hex string
    return new Promise((resolve, reject) => {
        crypto.randomBytes(64, (err, buf) => {
            if (!err) {
                let token = buf.toString('hex');

                return resolve(token)
            }
        })
    })
}

UserSchema.methods.createSession = function () {
    let user = this;

    return user.generateRefreshAuthToken().then((refreshToken) => {
        return saveSessionToDatabase(user, refreshToken)
    }).then((refreshToken) => {
        //
        return refreshToken;
    }).catch((e) => {
        return Promise.reject('FAILED TO SAVE TO DATABASE.\n' + e)
    })
}

//MODEL METHODS
UserSchema.statics.getJWTSecret = () => {
    //console.log(jwtSecret);
    return jwtSecret;
}

UserSchema.statics.findByIdAndToken = function (_id, token) {
    //finds user by id and token
    //used in auth middleware (verifySession)
    const User = this;

    return User.findOne({
        _id,
        'sessions.token': token
    });
}

UserSchema.statics.findByCredentials = function (username, password) {
    let User = this;

    return User.findOne({ username }).then((user) => {
        if (!user) return Promise.reject();

        return new Promise((resolve, reject) => {
            bcrypt.compare(password, user.password, (err, res) => {
                if (res) resolve(user);

                else {
                    reject();
                }
            })
        })
    })
}

UserSchema.statics.hasRefreshTokenExpired = (expiresAt) => {
    let secondsSinceEpoch = Date.now() / 1000;
    if (expiresAt > secondsSinceEpoch) {
        return false;
    } else {
        return true;
    }
}

//MIDDLEWARE
//BEFORE A DOC IS SAVED, THIS CODE RUNS
UserSchema.pre('save', function (next) {
    let user = this;
    let costFactor = 10;

    if (user.isModified('password')) {
        //run if password field edited
        //generate salt and hash password
        bcrypt.genSalt(costFactor, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash;
                next()
            })
        })
    } else {
        next()
    }
})

//HELPER METHODS
let saveSessionToDatabase = (user, refreshToken) => {
    //save session to the database
    return new Promise((resolve, reject) => {
        let expiresAt = generateRefreshTokenExpiryTime()

        user.sessions.push({ 'token': refreshToken, expiresAt });

        user.save().then(() => {
            //save session succesfully
            return resolve(refreshToken)
        }).catch((e) => {
            reject(e)
        })
    })
}

let generateRefreshTokenExpiryTime = () => {
    let daysUntilExpire = "10";
    let secondsUntilExpire = ((daysUntilExpire * 24) * 60) * 60;

    return ((Date.now() / 1000) + secondsUntilExpire)
}

const User = mongoose.model('User', UserSchema);

module.exports = { User }