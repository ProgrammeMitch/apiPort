const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const { mongoose } = require('./db/mongoose')
const jwt = require('jsonwebtoken');
require('dotenv').config();

//production condition
if (process.env.NODE_ENV === "production") {
    app.use(express.static("build"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname,  "build", "index.html"));
    });
  }

//LOAD MONGOOSE MODELS
const { wallets, User, cycle } = require('./db/models/index');


//LOAD MIDDLEWARE
app.use(bodyParser.json());

//check if request has valid jwt token
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');
    //verify jwt
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if (err) {
            //error... Do not Authenticate
            res.status(401).send(err)
        } else {
            //valid jwt
            req.user_id = decoded._id;
            next();
        }
    })
}

//Verify refresh token to verify session
let verifySession = (req, res, next) => {
    let refreshToken = req.header('x-refresh-token');

    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            return Promise.reject({
                'error': 'User Not Found'
            });
        }

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if (session.token === refreshToken) {
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {

            next();
        } else {

            return Promise.reject({
                'error': 'Refresh Token has expired'
            })
        }
    }).catch((e) => {
        console.log(refreshToken)
        res.status(401).send(e)
    })
}

//CORS MIDDLEWARE
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Methods", 'GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE')
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id, _userId, walletId");

    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    )

    next();
});

/* SignUp and Login Handlers */

//SIGN UP ROUTE
app.post('/users', (req, res) => {
    //user sign up
    let body = req.body;
    let newUser = new User(body);

    newUser.save().then((newUser) => {
        return newUser.createSession().then((refreshToken) => {
            //session created successfully
            //generate access auth token for user
            return newUser.generateAccessAuthToken().then((accessToken) => {
                //access auth token generated successfully
                return {accessToken, refreshToken}
            })
        }).then((authTokens) => {
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(newUser);
        })
    }).catch((e) => {
        res.status(400).send(e)
    })
})

// LOGIN
app.post('/users/login', (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    User.findByCredentials(username, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            return user.generateAccessAuthToken().then((accessToken) => {
                return { accessToken, refreshToken }
            })
        }).then((authTokens) => {
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user)
        })
    }).catch((e) => {
        res.status(400).send(e)
    });
})

//This route gets all the users but reveals only the id

app.get('/users/:id', authenticate, (req, res) => {
    //Retrieve Wallet
    User.find({
        _id: req.params.id
    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

//updating information of a user
//would be linked to the profile creation
app.patch('/users/:id', authenticate, (req, res) => {
    //Append to Profile
    User.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//the route to messges which is control by the id
//receiving messages for user
app.patch('/users/:id/messages', (req, res) => {
    User.findOneAndUpdate({ _id: req.params.id }, {
        $addToSet: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//GET ACCESS TOKEN
app.get('/users/me/access-token', verifySession, (req, res) => {
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    })
})

/* ROUTE HANDLERS */

//WALLET

app.post('/wallet', authenticate, (req, res) => {
    //Create A Wallet
    let walletId = req.body.walletId;

    let walletInfo = new wallets({
        walletId,
        _userId: req.user_id
    });
    walletInfo.save().then((walletInfo) => {
        res.send(walletInfo)
    })
})

app.get('/wallet', authenticate, (req, res) => {
    //Retrieve Wallet based on userid
    wallets.find({
        _userId: req.user_id
    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

app.patch('/wallet/:id', authenticate, (req, res) => {
    //Update a wallet based on userid
    wallets.findOneAndUpdate({ _id: req.params.id}, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//update route for when a wallet joins a cycle
app.patch('/wallet/:id/my-cycle', authenticate, (req, res) => {
    //Update a wallet
    wallets.findOneAndUpdate({ _id: req.params.id }, {
        $addToSet: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//update route for when a wallet leaves a cycle
app.patch('/wallet/:id/remove-cycle',(req, res) => {
    //Update a wallet
    wallets.findOneAndUpdate({ _id: req.params.id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//route for all wallet transactions
app.patch('/wallet/:id/transactions', (req, res) => {
    wallets.findOneAndUpdate({ _id: req.params.id }, {
        $addToSet: req.body
    }).then(() => {
        res.sendStatus(200)
    })
})

//CYCLE

app.post('/cycles', authenticate, (req, res) => {
    //Create A Cycle
    let wallet = req.body.wallet;
    let cycleAmount = req.body.cycleAmount;
    let cycleDuration = req.body.cycleDuration;
    let cycleStartDate = req.body.cycleStartDate;
    let frequency = req.body.frequency;

    let cycleInfo = new cycle({
        wallet,
        cycleAmount,
        cycleDuration,
        cycleStartDate,
        frequency,
        _userId: req.user_id
    });

    cycleInfo.save().then((cycleInfo) => {
        res.send(cycleInfo)

    })
})

app.patch('/cycles/:id', (req, res) => {
    //Update a cycle with a wallet
    cycle.findOneAndUpdate({ _id: req.params.id }, {
        $addToSet: req.body
    }).then(() => {
        res.sendStatus(200)
    }).catch((err) => {
        res.send(err)
    })
})

app.patch('/cycles/:id/leave-cycle', authenticate, (req, res) => {
    //Update a cycle remove a wallet
    cycle.findOneAndUpdate({ _id: req.params.id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200)
    }).catch((err) => {
        res.send(err)
    })
})

//get all cycles in system
app.get('/cycles', (req, res) => {
    //Retrieve all cycles
    cycle.find({

    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

//retrieve route for one particular cycle
app.get('/cycles/:id', (req, res) => {
    //Retrieve details of a cycle including Wallets
    cycle.find({
        _id: req.params.id
    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

//Admin Routes
app.get('/', () => {
    console.log("Home Page")
})

app.get('/users', (req, res) => {
    //Retrieve all users
    User.find({

    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

app.get('/wallet/:id', (req, res) => {
    //Retrieve Wallet
    wallets.find({
        _id: req.params.id
    }).then((walletInfo) => {
        res.send(walletInfo);
    }).catch((e) => {
        res.send(e);
    });
})

app.delete('/user/:id', authenticate, (req, res) => {
    //delete a wallet
    User.findOneAndRemove({
        _id: req.params.id
    }).then((removedUser) => {
        res.send(removedUser)
    })
})

app.delete('/wallet/:id', authenticate, (req, res) => {
    //delete a wallet
    wallets.findOneAndRemove({
        _id: req.params.id
    }).then((removedWallet) => {
        res.send(removedWallet)
    })
})

app.delete('/cycles/:id', (req, res) => {
    cycle.findOneAndRemove({
        _id: req.params.id
    }).then((removedWallet) => {
        res.send(removedWallet)
    })
})

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log("Server is listening on port 3000")
})