const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {
  registerUser,
  loginUser,
  getUsers,
  // SignInUser,
} = require("../controllers/userController");
const passport = require("passport");

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
// start auth (public)
router.get(
  "/auth/microsoft",
  passport.authenticate("microsoft", { prompt: "select_account" })
);

router.get(
  "/auth/microsoft/callback",
  passport.authenticate("microsoft", {
    failureRedirect:
      "https://chat-application-qarpuogfs-polinaidus-projects.vercel.app/",
    session: false,
  }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.redirect(
      `https://chat-application-qarpuogfs-polinaidus-projects.vercel.app/home?token=${token}&id=${user.id}&email=${user.email}`
    );
  }
);

// app.get("/logout", (req, res) => {
//   req.logout(() => {
//     res.redirect("/");
//   });
// });

// router.post("/signIn", SignInUser);
router.get("/", getUsers);

module.exports = router;
