const multer = require("multer");
const path = require("path");

// storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // local uploads folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// file filter (only images & pdfs allowed)
const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
        cb(null, true);
    } else {
        cb(new Error("Only images and pdfs are allowed!"));
    }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
