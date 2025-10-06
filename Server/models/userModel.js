const db = require("../config/db");

const createUser = async (name, email, hashedPassword, profileImage) => {
  const [result] = await db.query(
    "INSERT INTO users (name, email, password, profile_image) VALUES (?, ?, ?, ?)",
    [name, email, hashedPassword, profileImage]
  );
  return result;
};

const findUserByEmail = async (email) => {
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
};

const findUserById = async (id) => {
  const [rows] = await db.query(
    "SELECT id, name, email, profile_image FROM users WHERE id = ?",
    [id]
  );
  return rows[0];
};

const getAllUsers = async () => {
  const [rows] = await db.query(
    "SELECT id, name, email, profile_image FROM users"
  );
  return rows;
};

module.exports = {
  createUser,
  findUserByEmail,
  getAllUsers,
  findUserById,
};
