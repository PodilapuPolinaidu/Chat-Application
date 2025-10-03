const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; 
  if (!token) return res.status(401).json({ msg: "No token, unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded; // store user in request
    next();
  } catch (err) {
    res.status(403).json({ msg: "Invalid token" });
  }
};

module.exports = authMiddleware;
