const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

//middlewares
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;

//import routes
const routes = require("./routes/authRoutes");
const routesForInvite = require("./routes/inviteRoutes");
app.use("/api/v1",routes);
app.use("/api/v1",routesForInvite);
app.use("/api/v1/bills", require("./routes/billRoutes"));
//db connection
const db_connection = require("./config/db");
db_connection();

app.get("/" , async(req,res)=>{
    res.send("hello jii");
})
app.listen(PORT,async(req,res)=>{
    console.log(`app started at ${PORT}`);
});