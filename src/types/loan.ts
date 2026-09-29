export type LoanStatus =
  | "pending_approval"
  | "needs_review"
  | "active"
  | "completed"
  | "rejected"
  | "defaulted";

export type AccountStatus = "open" | "closed";

export type PaymentFrequency =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

export type PaymentStatus =
  | "upcoming"
  | "paid"
  | "overdue"
  | "partial"
  | "disputed";

export interface CooperativeLoanAllocation {
  memberId: string;
  memberName: string;
  amount: number;
}

export interface Loan {
  id: string;
  firestoreId?: string;
  applicantId: string;
  applicantName: string;
  applicantType: "individual" | "cooperative";
  cooperativeId?: string;
  cooperativeName?: string;
  memberAllocations?: CooperativeLoanAllocation[];
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  paymentFrequency: PaymentFrequency;
  purpose: string;
  totalInterest: number;
  totalRepayment: number;
  installmentAmount: number;
  numberOfPayments: number;
  status: LoanStatus;
  accountStatus: AccountStatus;
  totalPaid: number;
  remainingBalance: number;
  defaultedPayments: number;
  onTimePayments: number;
  nextPaymentDue: string;
  hasHistoryFlag: boolean;
  historyNotes: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  previousRejectedReason?: string;
  resubmissionNotes?: string;
  resubmittedAt?: string;
  notes: string;
  startDate?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  applicantId: string;
  memberId?: string;
  memberName?: string;
  isEarlyRepayment?: boolean;
  paymentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  paidAt?: string;
  paidBy?: string;
  paidByName?: string;
  receiptImage?: string;
  receiptNotes?: string;
  disputeReason?: string;
  lastDisputeReason?: string;
  disputedAt?: string;
  disputedBy?: string;
  resubmittedAt?: string;
  resubmissionNotes?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface LoanIncomeExpense {
  id: string;
  userId: string;
  userName: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string;
  loanId?: string;
  receiptImage?: string;
  createdAt: string;
  createdBy: string;
}

export const INCOME_CATEGORIES = [
  "Product Sale",
  "Harvest Sale",
  "Livestock Sale",
  "Services Rendered",
  "Government Subsidy",
  "Other Income",
] as const;

export const EXPENSE_CATEGORIES = [
  "Seeds & Seedlings",
  "Fertilizer",
  "Pesticides",
  "Labor Cost",
  "Equipment Rental",
  "Transportation",
  "Loan Payment",
  "Other Expense",
] as const;

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly (Every 3 months)",
  semi_annual: "Semi-Annual (Every 6 months)",
  annual: "Annual (Yearly)",
};

export const FREQUENCY_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

export const LOAN_STATUS_CONFIG: Record<
  LoanStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending_approval: {
    label: "Pending Approval",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  needs_review: {
    label: "Needs Review",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
  active: {
    label: "Active",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  completed: {
    label: "Completed",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  defaulted: {
    label: "Defaulted",
    color: "text-red-700",
    bgColor: "bg-red-100 border-red-300",
  },
};

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bgColor: string }
> = {
  upcoming: {
    label: "Upcoming",
    color: "text-slate-600",
    bgColor: "bg-slate-50 border-slate-200",
  },
  paid: {
    label: "Paid",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  overdue: {
    label: "Overdue",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  partial: {
    label: "Partial",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  disputed: {
    label: "Disputed",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
};

export function generateLoanId(): string {
  return `LOAN-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function calculateLoanSchedule(
  principal: number,
  interestRate: number,
  termMonths: number,
  frequency: PaymentFrequency,
  startDate: Date,
): {
  totalInterest: number;
  totalRepayment: number;
  installmentAmount: number;
  numberOfPayments: number;
  schedule: { paymentNumber: number; dueDate: string; amountDue: number }[];
} {
  const totalInterest =
    Math.round(principal * (interestRate / 100) * (termMonths / 12) * 100) /
    100;
  const totalRepayment = principal + totalInterest;
  const monthsPerPayment = FREQUENCY_MONTHS[frequency];
  const numberOfPayments = Math.ceil(termMonths / monthsPerPayment);
  const installmentAmount =
    Math.round((totalRepayment / numberOfPayments) * 100) / 100;
  const schedule = [];

  for (let i = 0; i < numberOfPayments; i += 1) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i + 1) * monthsPerPayment);
    const amountDue =
      i === numberOfPayments - 1
        ? Math.round(
            (totalRepayment - installmentAmount * (numberOfPayments - 1)) * 100,
          ) / 100
        : installmentAmount;
    schedule.push({
      paymentNumber: i + 1,
      dueDate: dueDate.toISOString(),
      amountDue,
    });
  }

  return {
    totalInterest,
    totalRepayment,
    installmentAmount,
    numberOfPayments,
    schedule,
  };
}

export function checkLoanHistory(pastLoans: Loan[]): {
  hasDefaults: boolean;
  totalLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  totalDefaultedPayments: number;
  historyNotes: string;
} {
  const totalLoans = pastLoans.length;
  const completedLoans = pastLoans.filter(
    (loan) => loan.status === "completed",
  ).length;
  const defaultedLoans = pastLoans.filter(
    (loan) => loan.status === "defaulted",
  ).length;
  const totalDefaultedPayments = pastLoans.reduce(
    (sum, loan) => sum + (loan.defaultedPayments || 0),
    0,
  );
  const hasDefaults = totalDefaultedPayments > 0 || defaultedLoans > 0;
  let historyNotes = `${totalLoans} previous loan(s)`;
  if (completedLoans > 0) historyNotes += `, ${completedLoans} completed`;
  if (defaultedLoans > 0) historyNotes += `, ${defaultedLoans} defaulted`;
  if (totalDefaultedPayments > 0) {
    historyNotes += `, ${totalDefaultedPayments} missed payment(s)`;
  }
  if (!hasDefaults && totalLoans > 0) {
    historyNotes += " — clean record";
  }

  return {
    hasDefaults,
    totalLoans,
    completedLoans,
    defaultedLoans,
    totalDefaultedPayments,
    historyNotes,
  };
}
