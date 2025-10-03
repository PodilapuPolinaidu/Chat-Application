const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  registerUser,
  loginUser,
  getUsers,
} = require("../controllers/userController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(__dirname, "..", "uploads", req.body.name);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => cb(null, file.originalname.split(" ").join("")),
});
const upload = multer({ storage });

router.post("/register", upload.single("image"), registerUser);
router.post("/login", loginUser);
router.get("/", getUsers);

module.exports = router;
