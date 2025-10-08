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
      expiresIn: "24h",
    });

    const isProduction = process.env.NODE_ENV === "production";
    const frontendDomain = isProduction
      ? "chat-application-eg5ehd8r9-polinaidus-projects.vercel.app"
      : "localhost";

    const cookieOptions = {
      httpOnly: false, // Allow frontend JavaScript to access
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? "none" : "lax", // 'none' for cross-site in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
      domain: isProduction ? ".vercel.app" : undefined, // Allow subdomains in production
    };

    res.cookie("token", token, cookieOptions);
    res.cookie("id", user.id.toString(), cookieOptions);
    res.cookie("Email", user.email, cookieOptions);
    res.cookie("userName", user.name, cookieOptions);

    res.json({
      msg: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
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
