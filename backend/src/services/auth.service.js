import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(payload, options = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required.");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    ...options,
  });
}

export function verifyAccessToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required.");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
}
