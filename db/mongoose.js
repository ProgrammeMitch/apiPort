//This file will handle connection logic to the MongoDb db

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://0.0.0.0:27017/CycleBeta11', {useNewUrlParser: true}).then(() => {
    console.log("Connected to MongoDB succesfully");
}).catch((e) => {
    console.log("Error while attempting to conect to MongoDB");
    console.log(e);
});

//Prevent Deprecation warnings (from MongoDB native driver)
//mongoose.set('useCreateIndex', true);
//mongoose.set('useFindAndModify', false);

module.exports = {
    mongoose
};