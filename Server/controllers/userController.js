const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
require("dotenv").config();

const secretKey = process.env.SECRET_KEY;

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.file ? req.file.filename : null;

    const result = await userModel.createUser(
      name,
      email,
      hashedPassword,
      profileImage
    );

    res.status(201).json({ msg: "User registered", userId: result.insertId });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findUserByEmail(email);

    if (!user) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, secretKey, {
      expiresIn: "5h",
    });
    const cookieOptions = {
      httpOnly: false,
      secure: false,
      maxAge: 3600000000,
      sameSite: "lax",
      path: "/",
    };

    res.cookie("token", token, cookieOptions);

    res.cookie("id", user.id, cookieOptions);
    res.cookie("Email", user.email, cookieOptions);
    res.json({ msg: "Login successful", token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
};

async function findOrCreateUser(profile) {
  const email = profile._json.preferred_username || profile._json.email;
  let user = await userModel.findUserByEmail(email);

  if (!user) {
    user = await userModel.createUser(
      profile.displayName,
      email,
      "OAuth User",
      profile._json.picture || ""
    );
  }
  return user;
}

const getUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { registerUser, loginUser, getUsers, findOrCreateUser };
