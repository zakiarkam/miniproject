import bcrypt from "bcrypt";

// Hash a password securely
export async function hashPassword(password) {
  const saltRounds = 12; // strong hashing
  return await bcrypt.hash(password, saltRounds);
}

// Verify a password against stored hash
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}