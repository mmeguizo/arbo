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
          email: toEmail,
          recipient: toEmail,
          otp_code: otpCode,
          otp: otpCode,
          code: otpCode,
          passcode: otpCode,
          expiry_minutes: expiryMinutes,
          app_name: "ARBO Support — Department of Agrarian Reform",
          message: `Your ARBO Support verification code is ${otpCode}. This code is valid for ${expiryMinutes} minutes. If you did not request this code, please secure your account immediately.`,
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
