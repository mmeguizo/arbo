import React from "react";

export type ApplicationStatus =
  | "under_review"
  | "verified"
  | "awarded"
  | "disputed";

interface StatusBadgeProps {
  status: ApplicationStatus;
  correctionStatus?: string | null;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  correctionStatus,
}) => {
  const getStyles = () => {
    // Check for correction-returned overlay
    if (
      correctionStatus === "correction_encoder" ||
      correctionStatus === "correction_staff"
    ) {
      const isEncoder = correctionStatus === "correction_encoder";
      return {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        dot: "bg-red-500",
        label: isEncoder
          ? "Returned to Encoder (Correction)"
          : "Returned to Staff (Correction)",
      };
    }

    switch (status) {
      case "verified":
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
          dot: "bg-emerald-500",
          label: "For Admin Approval",
        };
      case "awarded":
        return {
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
          dot: "bg-blue-500",
          label: "Awarded (Title Encoded)",
        };
      case "under_review":
        return {
          bg: "bg-orange-50",
          text: "text-orange-700",
          border: "border-orange-200",
          dot: "bg-orange-500",
          label: "For Verification (Staff Stage)",
        };
      case "disputed":
        return {
          bg: "bg-rose-50",
          text: "text-rose-700",
          border: "border-rose-200",
          dot: "bg-rose-500",
          label: "Disputed",
        };
      default:
        return {
          bg: "bg-slate-50",
          text: "text-slate-700",
          border: "border-slate-200",
          dot: "bg-slate-400",
          label: "Unknown",
        };
    }
  };

  const styles = getStyles();

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles.bg} ${styles.text} ${styles.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}></span>
      <span>{styles.label}</span>
    </span>
  );
};
