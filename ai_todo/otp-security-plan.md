# Email OTP Two-Factor Authentication (2FA) Implementation Plan

> **Status**: 📋 READY FOR WORKER  
> **Created by**: Planner (2026-10-21)  
> **Goal**: Add Email OTP Two-Factor Authentication (2FA) for all user roles upon login, securing access after primary credential verification.  
> **Tech Stack**: React 19, TypeScript 6, Firebase Auth (v12), Cloud Firestore, EmailJS REST API, Tailwind CSS v4, Lucide React.  
> **Prerequisites**: Read `PROJECT_CONTEXT.md`, `SESSION_HANDOVER.md`, `GEMINI.md`, and `docs/superpowers/specs/2026-10-21-email-otp-security-design.md`.

---

## Architecture & Authentication Flow

1. **Step 1 — Primary Authentication (Credentials)**:
   - User inputs email and password on `/login`.
   - Firebase verifies credentials with `signInWithEmailAndPassword`.
   - If credentials fail, show error. **No OTP is generated or sent** (protects against spam and email bombing).

2. **Step 2 — OTP Generation & Dispatch**:
   - On valid credentials, generate a secure 6-digit random code.
   - Store record in Firestore `/auth_otps/{uid}` (10-minute expiry, max 5 attempts).
   - Dispatch email using EmailJS REST API to the user's registered email address.
   - If in development mode (no EmailJS keys configured in `.env`), show a helpful preview toast/banner so developers/testers are not locked out.

3. **Step 3 — 2FA Challenge & Verification**:
   - Login page transitions to the OTP screen with 6 auto-advancing numeric input cells, paste support, and a countdown timer.
   - User enters 6-digit code.
   - App validates against Firestore `/auth_otps/{uid}`.
   - On match, set `isOtpVerified = true` in `AuthContext` and `sessionStorage`.
   - Redirect to user role landing page (`/my-application`, `/arbo-dashboard`, or `/dashboard`).

4. **Step 4 — Route Gatekeeping**:
   - `ProtectedRoute.tsx` verifies that `user`, `profile`, AND `isOtpVerified` are valid.
   - If an unverified user navigates directly to any protected URL, redirect to `/login` to complete the OTP challenge.
   - On `logout()`, session verification is immediately revoked.

---

## Firestore Collection Schema: `/auth_otps/{uid}`

Document ID: `uid` (Firebase User ID)

```typescript
export interface AuthOtpDocument {
  uid: string;
  email: string;
  otpCode: string;           // 6-digit string, e.g. "592813"
  expiresAt: string;         // ISO timestamp (now + 10 mins)
  attempts: number;          // Failed attempts counter (max 5)
  createdAt: string;         // ISO timestamp
  used: boolean;             // Set to true upon successful verification
}
```

---

## Implementation Tasks

### Task 1: Create Email Service (`src/services/emailService.ts`)
Create a lightweight email dispatcher that sends OTP codes via EmailJS REST API without external bundle bloat, including dev fallback mode.

- **File**: `src/services/emailService.ts` [NEW]
- **Exact Code**:
```typescript
/**
 * Email Service for ARBO Web App
 * Dispatches transactional OTP emails using EmailJS REST API
 * (https://api.emailjs.com/api/v1.0/email/send)
 */

interface SendOtpParams {
  toEmail: string;
  otpCode: string;
  expiryMinutes?: number;
}

export const sendOtpEmail = async ({
  toEmail,
  otpCode,
  expiryMinutes = 10,
}: SendOtpParams): Promise<{ success: boolean; isDevMode?: boolean; error?: string }> => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  // Development Fallback: If EmailJS credentials are not yet configured in .env
  if (!serviceId || !templateId || !publicKey) {
    console.warn(
      `[EmailJS Dev Mode] VITE_EMAILJS credentials not set. Simulated OTP for ${toEmail}: ${otpCode}`
    );
    return { success: true, isDevMode: true };
  }

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: toEmail,
          otp_code: otpCode,
          expiry_minutes: expiryMinutes,
          app_name: "ARBO Support — Department of Agrarian Reform",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("EmailJS dispatch failed:", errText);
      return { success: false, error: errText || "Failed to send email via EmailJS." };
    }

    return { success: true, isDevMode: false };
  } catch (err: any) {
    console.error("EmailJS network error:", err);
    return { success: false, error: err.message || "Network error while sending email." };
  }
};
```

---

### Task 2: Create OTP Service (`src/services/otpService.ts`)
Manages Firestore document generation, verification, retry counting, and expiration checks.

- **File**: `src/services/otpService.ts` [NEW]
- **Exact Code**:
```typescript
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
```

---

### Task 3: Update `AuthContext.tsx` with OTP Session State
Add `isOtpVerified` and `setSessionOtpVerified` to manage session authorization.

- **File**: `src/contexts/AuthContext.tsx` [MODIFY]
- **Diff / Changes**:
  1. Add `isOtpVerified: boolean` and `setSessionOtpVerified: (verified: boolean) => void` to `AuthContextType`.
  2. Maintain `isOtpVerified` state initialized from `sessionStorage.getItem('arbo_otp_verified_' + currentUser.uid) === 'true'`.
  3. Clear `sessionStorage.removeItem('arbo_otp_verified_' + user.uid)` inside `logout()`.

```typescript
// Add to interface AuthContextType:
isOtpVerified: boolean;
setSessionOtpVerified: (verified: boolean) => void;

// In AuthProvider:
const [isOtpVerified, setIsOtpVerified] = useState<boolean>(false);

const setSessionOtpVerified = (verified: boolean) => {
  setIsOtpVerified(verified);
  if (user) {
    if (verified) {
      sessionStorage.setItem(`arbo_otp_verified_${user.uid}`, "true");
    } else {
      sessionStorage.removeItem(`arbo_otp_verified_${user.uid}`);
    }
  }
};

// In onAuthStateChanged callback:
if (currentUser) {
  const verifiedInSession =
    sessionStorage.getItem(`arbo_otp_verified_${currentUser.uid}`) === "true";
  setIsOtpVerified(verifiedInSession);
  // ... existing code ...
} else {
  setIsOtpVerified(false);
  // ... existing code ...
}

// In logout():
if (user) {
  sessionStorage.removeItem(`arbo_otp_verified_${user.uid}`);
}
setIsOtpVerified(false);
```

---

### Task 4: Update `ProtectedRoute.tsx` to Enforce OTP
Block access to protected routes if the user is authenticated in Firebase but has not verified their 2FA OTP.

- **File**: `src/components/ProtectedRoute.tsx` [MODIFY]
- **Logic**:
```typescript
const { user, profile, loading, isOtpVerified } = useAuth();

// ... after user and profile existence checks ...

// 2FA Verification Gate
if (!isOtpVerified) {
  return <Navigate to="/login" state={{ requireOtp: true }} replace />;
}
```

---

### Task 5: Enhance `Login.tsx` with 2FA Challenge Screen
Integrate the 2-step authentication flow with clean, auto-advancing 6-digit numeric input cells.

- **File**: `src/pages/Login.tsx` [MODIFY]
- **Key Features**:
  1. `step`: `"credentials" | "otp"`.
  2. When email & password match:
     - Don't navigate away yet; invoke `createAndSendOtp(userCredential.user.uid, email)`.
     - Set `step = "otp"`.
  3. Six segmented digit input cells:
     - Handles typing, backspace focus shifting, and pasting a 6-digit code.
  4. Timer displaying remaining time (10 minutes).
  5. Resend button with a 60-second cooldown timer.
  6. "Sign in with a different account" button that signs out the unverified Firebase session and resets back to `step = "credentials"`.
  7. Dev mode banner: If running in development without EmailJS keys, display the OTP code in a dismissible notification so testing is instantaneous.

---

### Task 6: Environment Configuration
Update `.env.example` to document EmailJS parameters.

- **File**: `.env.example` [NEW or MODIFY]
```env
# EmailJS Transactional Email Config (for 2FA OTP)
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

---

## Verification Checklist

- [ ] `npm run build` succeeds with 0 errors.
- [ ] Submitting bad email/password displays error and **never** writes to `/auth_otps`.
- [ ] Submitting valid credentials triggers OTP generation, displays 2FA challenge screen with user's masked email.
- [ ] Entering incorrect code shows remaining attempts error.
- [ ] Entering correct 6-digit code grants access and redirects to the appropriate role dashboard.
- [ ] Directly visiting `/dashboard` or `/my-application` while unverified redirects to OTP challenge.
- [ ] Clicking "Sign in with a different account" cancels the challenge and clears the session.
- [ ] Logging out requires OTP verification upon subsequent login.
