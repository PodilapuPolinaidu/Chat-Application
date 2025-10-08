const pool = require("../config/db");

const createUser = async (name, email, hashedPassword, profileImage) => {
  const result = await pool.query(
    "INSERT INTO users (name, email, password, profile_image) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, email, hashedPassword, profileImage]
  );
  return result.rows[0];
};

const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
};

const findUserById = async (id) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, profile_image FROM users WHERE id = $1",
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error in findUserById:", error);
    return null;
  }
};

const getAllUsers = async () => {
  const result = await pool.query(
    "SELECT id, name, email, profile_image FROM users"
  );
  return result.rows;
};

module.exports = {
  createUser,
  findUserByEmail,
  getAllUsers,
  findUserById,
};
