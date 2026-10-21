# Phase 19: In-App Password Management & Reset — Worker Spec

> **Status**: ✅ COMPLETED (2026-10-21)
> **Created by**: Planner (2026-10-21)
> **Goal**: 
> 1. Allow any logged-in user (including Admin) to change their password directly in the ARBO app without Firebase console.
> 2. Allow users who forgot their password to receive a reset link, open it in the ARBO app, and type their new password directly.
> 3. Allow Admins to trigger a password reset for any user from the Admin Users management table with EmailJS delivery.
> **Prerequisites**: Read `PROJECT_CONTEXT.md`, `SESSION_HANDOVER.md`, `GEMINI.md`.

---

## What We're Building

1. **Self-Service Password Change (`ChangePasswordModal.tsx`)**:
   - Accessible from `Sidebar.tsx` for all logged-in roles (Admin, Staff, Encoder, ARB, ARBO Head).
   - Prompts for Current Password, New Password, and Confirm Password.
   - Re-authenticates via `reauthenticateWithCredential` and updates via `updatePassword`.
   - Writes an audit log entry upon success.

2. **In-App Password Reset Flow (`Login.tsx`)**:
   - Detects `?mode=resetPassword&oobCode=...` query parameters from the password reset email.
   - Verifies the reset code via `verifyPasswordResetCode(auth, oobCode)`.
   - Renders a clean "Set New Password" form directly in the ARBO interface.
   - Confirms the reset with `confirmPasswordReset(auth, oobCode, newPassword)` and returns to login.

3. **Admin User Password Reset Action (`AdminUsers.tsx`)**:
   - Replaces the generic icon click with an actionable confirmation modal.
   - Dispatches password reset email with `actionCodeSettings` directing back to `/login`.
   - Dispatches an EmailJS notification so delivery is guaranteed to the user's primary inbox.

4. **Email Dispatcher Updates (`emailService.ts`)**:
   - Adds `sendPasswordResetNotificationEmail`.
   - Supports `VITE_EMAILJS_RESET_TEMPLATE_ID` with fallback to `VITE_EMAILJS_TEMPLATE_ID`.
