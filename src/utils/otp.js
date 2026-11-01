import crypto from "crypto";

// Shared by forgot password and profile edit
export const OTP_MINUTES = 10;

// 6 digits, leading zeros kept
export const generateOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");

export const isOtpFormat = (otp) => /^\d{6}$/.test(otp);

// Only the HMAC of an OTP is stored. scope + key (user id / email) bind it to one flow and one
// person, so an OTP of one flow or user never matches another.
export const hashOtp = (scope, key, otp) => {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("OTP_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(`${scope}:${key}:${otp}`).digest("hex");
};

// Expiry for the SPs, which compare it with NOW(); the database clock runs in UTC, so send UTC
// (a JS Date would be sent in the server's local time, e.g. IST locally).
export const otpExpiresAt = () =>
  new Date(Date.now() + OTP_MINUTES * 60000).toISOString().slice(0, 19).replace("T", " ");
