const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL)
        console.log("database is connected successfully");
    }
    catch(err){
        console.log(err);
        console.log("couldn't connect database");
        process.exit(1);
    }
}
module.exports = connectDB;