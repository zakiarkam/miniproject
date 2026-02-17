import { verifyOTP } from "./otpService";

export async function enforceMFA(user, otpInput) {
  if (user.role === "admin" || user.role === "organization") {
    const isValid = await verifyOTP(user.id, otpInput);
    if (!isValid) throw new Error("MFA verification failed");
  }
}