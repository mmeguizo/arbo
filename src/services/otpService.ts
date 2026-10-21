import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { sendOtpEmail } from "./emailService";

export interface AuthOtpDocument {
  uid: string;
  email: string;
  otpCode: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
  used: boolean;
}

const EXPIRATION_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generates a cryptographically random 6-digit numeric string
 */
export const generateOtpCode = (): string => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const code = (array[0] % 900000) + 100000;
  return code.toString();
};

/**
 * Creates a new OTP record in Firestore and sends it to the user's email
 */
export const createAndSendOtp = async (
  uid: string,
  email: string
): Promise<{ success: boolean; isDevMode?: boolean; error?: string; devOtp?: string }> => {
  try {
    const otpCode = generateOtpCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRATION_MINUTES * 60 * 1000).toISOString();

    const otpDoc: AuthOtpDocument = {
      uid,
      email,
      otpCode,
      expiresAt,
      attempts: 0,
      createdAt: now.toISOString(),
      used: false,
    };

    const docRef = doc(db, "auth_otps", uid);
    await setDoc(docRef, otpDoc);

    const emailResult = await sendOtpEmail({
      toEmail: email,
      otpCode,
      expiryMinutes: EXPIRATION_MINUTES,
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error };
    }

    return {
      success: true,
      isDevMode: emailResult.isDevMode,
      devOtp: emailResult.isDevMode ? otpCode : undefined,
    };
  } catch (err: any) {
    console.error("Error creating OTP:", err);
    return { success: false, error: err.message || "Failed to generate security code." };
  }
};

/**
 * Verifies the user-entered 6-digit OTP against the Firestore record
 */
export const verifyOtpCode = async (
  uid: string,
  enteredCode: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const docRef = doc(db, "auth_otps", uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, error: "No active verification code found. Please request a new one." };
    }

    const data = snap.data() as AuthOtpDocument;

    if (data.used) {
      return { success: false, error: "This code has already been used. Please log in again." };
    }

    const isExpired = new Date(data.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return { success: false, error: "Verification code has expired. Please request a new code." };
    }

    if (data.attempts >= MAX_ATTEMPTS) {
      return {
        success: false,
        error: "Too many failed attempts. For security reasons, please request a new code.",
      };
    }

    if (data.otpCode !== enteredCode.trim()) {
      const nextAttempts = (data.attempts || 0) + 1;
      await updateDoc(docRef, { attempts: nextAttempts });
      const remaining = MAX_ATTEMPTS - nextAttempts;
      return {
        success: false,
        error: `Incorrect code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Please request a new code."}`,
      };
    }

    // Mark code as used
    await updateDoc(docRef, { used: true });
    return { success: true };
  } catch (err: any) {
    console.error("Error verifying OTP:", err);
    return { success: false, error: err.message || "Failed to verify security code." };
  }
};

/**
 * Checks if the user is allowed to resend an OTP based on the cooldown
 */
export const canResendOtp = async (
  uid: string
): Promise<{ allowed: boolean; waitSeconds?: number }> => {
  try {
    const docRef = doc(db, "auth_otps", uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { allowed: true };

    const data = snap.data() as AuthOtpDocument;
    const createdAtTime = new Date(data.createdAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - createdAtTime) / 1000);

    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      return { allowed: false, waitSeconds: RESEND_COOLDOWN_SECONDS - elapsedSeconds };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
};
