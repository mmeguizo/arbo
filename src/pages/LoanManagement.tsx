import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { writeAuditLog } from "../utils/audit";
import { exportToCSV, formatDate } from "../utils/formatters";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle,
  Download,
  FileText,
  Landmark,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  FREQUENCY_LABELS,
  LOAN_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  calculateLoanSchedule,
  type Loan,
  type LoanIncomeExpense,
  type LoanPayment,
  type LoanStatus,
} from "../types/loan";

type TabId =
  | "pending"
  | "active"
  | "payments"
  | "defaulters"
  | "reports"
  | "archive";

interface BorrowerProfile {
  uid: string;
  name: string;
  role: string;
}

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type PaymentScheduleDraft = {
  paymentNumber: number;
  dueDate: string;
  amountDue: number;
  applicantId: string;
  memberId?: string;
  memberName?: string;
};

const buildPaymentSchedule = (
  loan: Loan,
  rate: number,
  termMonths: number,
  startDate: Date,
): PaymentScheduleDraft[] => {
  if (loan.applicantType === "cooperative" && loan.memberAllocations?.length) {
    return loan.memberAllocations
      .filter((allocation) => allocation.amount > 0)
      .flatMap((allocation) =>
        calculateLoanSchedule(
          allocation.amount,
          rate,
          termMonths,
          loan.paymentFrequency,
          startDate,
        ).schedule.map((item) => ({
          ...item,
          applicantId: allocation.memberId,
          memberId: allocation.memberId,
          memberName: allocation.memberName,
        })),
      );
  }

  return calculateLoanSchedule(
    loan.principalAmount,
    rate,
    termMonths,
    loan.paymentFrequency,
    startDate,
  ).schedule.map((item) => ({
    ...item,
    applicantId: loan.applicantId,
  }));
};

export const LoanManagement: React.FC = () => {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [incomeExpenses, setIncomeExpenses] = useState<LoanIncomeExpense[]>(
    [],
  );
  const [borrowers, setBorrowers] = useState<BorrowerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [search, setSearch] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<LoanPayment | null>(
    null,
  );
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showEditTerms, setShowEditTerms] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [editRate, setEditRate] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const migratedCooperativeLoans = useRef(new Set<string>());

  useEffect(() => {
    const unsubLoans = onSnapshot(
      collection(db, "loans"),
      (snap) => {
        setLoans(
          snap.docs.map(
            (item) =>
              ({
                ...item.data(),
                id: String(item.data().id || item.id),
                firestoreId: item.id,
              }) as Loan,
          ),
        );
        setLoading(false);
      },
      (loadError) => {
        console.error("Failed to load loans:", loadError);
        setLoading(false);
      },
    );
    const unsubPayments = onSnapshot(collection(db, "loanPayments"), (snap) =>
      setPayments(
        snap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as LoanPayment,
        ),
      ),
    );
    const unsubIncomeExpenses = onSnapshot(
      collection(db, "loanIncomeExpenses"),
      (snap) =>
        setIncomeExpenses(
          snap.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as LoanIncomeExpense,
          ),
        ),
    );
    const unsubBorrowers = onSnapshot(
      query(
        collection(db, "users"),
        where("role", "in", ["arb", "arbo_head"]),
      ),
      (snap) =>
        setBorrowers(
          snap.docs.map((item) => {
            const data = item.data();
            return {
              uid: item.id,
              name: String(data.name || "Unknown"),
              role: String(data.role || "arb"),
            };
          }),
        ),
    );
    return () => {
      unsubLoans();
      unsubPayments();
      unsubIncomeExpenses();
      unsubBorrowers();
    };
  }, []);

  useEffect(() => {
    const migrations = loans
      .filter(
        (loan) =>
          loan.applicantType === "cooperative" &&
          loan.memberAllocations?.some((allocation) => allocation.amount > 0),
      )
      .map((loan) => ({
        loan,
        legacyPayments: payments.filter(
          (payment) =>
            payment.loanId === loan.id &&
            !payment.memberId &&
            payment.status !== "paid" &&
            payment.status !== "partial",
        ),
      }))
      .filter(
        ({ loan, legacyPayments }) =>
          legacyPayments.length > 0 &&
          !migratedCooperativeLoans.current.has(loan.id),
      );

    migrations.forEach(({ loan, legacyPayments }) => {
      migratedCooperativeLoans.current.add(loan.id);
      const paymentSchedule = buildPaymentSchedule(
        loan,
        loan.interestRate,
        loan.termMonths,
        new Date(loan.startDate || loan.createdAt),
      );
      const batch = writeBatch(db);
      legacyPayments.forEach((legacyPayment) => {
        batch.delete(doc(db, "loanPayments", legacyPayment.id));
        loan.memberAllocations
          ?.filter((allocation) => allocation.amount > 0)
          .forEach((allocation) => {
            const item = paymentSchedule.find(
              (candidate) =>
                candidate.memberId === allocation.memberId &&
                candidate.paymentNumber === legacyPayment.paymentNumber,
            );
            if (!item) return;
            const paymentRef = doc(collection(db, "loanPayments"));
            batch.set(paymentRef, {
              loanId: loan.id,
              ...item,
              amountPaid: 0,
              status: legacyPayment.status,
              disputeReason: legacyPayment.disputeReason || null,
              lastDisputeReason: legacyPayment.lastDisputeReason || null,
              createdAt: legacyPayment.createdAt || new Date().toISOString(),
            });
          });
      });
      void batch.commit().catch((migrationError) => {
        migratedCooperativeLoans.current.delete(loan.id);
        console.error(
          "Failed to split legacy cooperative payment records:",
          migrationError,
        );
      });
    });
  }, [loans, payments]);

  const pendingLoans = loans.filter(
    (loan) =>
      loan.status === "pending_approval" || loan.status === "needs_review",
  );
  const activeLoans = loans.filter((loan) => loan.status === "active");
  const reviewPayments = payments.filter(
    (payment) =>
      ((payment.status === "paid" || payment.status === "partial") &&
        !payment.verifiedAt) ||
      payment.status === "overdue" ||
      payment.status === "disputed",
  );
  const totalPrincipal = loans.reduce(
    (sum, loan) => sum + (loan.principalAmount || 0),
    0,
  );
  const totalExpectedPayments = payments.filter(
    (payment) => payment.status !== "disputed",
  ).length;
  const totalOnTimePayments = loans.reduce(
    (sum, loan) => sum + (loan.onTimePayments || 0),
    0,
  );
  const collectionRate =
    totalExpectedPayments === 0
      ? 0
      : Math.min(100, (totalOnTimePayments / totalExpectedPayments) * 100);
  const defaulterLoans = loans.filter(
    (loan) =>
      loan.defaultedPayments > 0 ||
      payments.some(
        (payment) =>
          payment.loanId === loan.id && payment.status === "overdue",
      ),
  );
  const loanRef = (loan: Loan) =>
    doc(db, "loans", loan.firestoreId || loan.id);
  const filteredLoans = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const tabLoans =
      activeTab === "pending"
        ? pendingLoans
        : activeTab === "active"
          ? activeLoans
          : activeTab === "archive"
            ? loans.filter((loan) =>
                ["completed", "defaulted", "rejected"].includes(loan.status),
              )
            : loans;
    if (!normalized) return tabLoans;
    return tabLoans.filter(
      (loan) =>
        loan.id.toLowerCase().includes(normalized) ||
        loan.applicantName.toLowerCase().includes(normalized) ||
        loan.purpose.toLowerCase().includes(normalized),
    );
  }, [activeTab, loans, search, pendingLoans, activeLoans]);

  const notifyApplicant = async (
    loan: Loan,
    type:
      | "loan_approved"
      | "loan_rejected"
      | "payment_verified"
      | "payment_disputed"
      | "payment_overdue"
      | "loan_defaulted"
      | "loan_completed",
    title: string,
    message: string,
    recipientId?: string,
  ) => {
    const recipientIds = recipientId
      ? [recipientId]
      : loan.applicantType === "cooperative"
        ? [
            loan.applicantId,
            ...(loan.memberAllocations || []).map(
              (allocation) => allocation.memberId,
            ),
          ]
        : [loan.applicantId];
    await Promise.all(
      [...new Set(recipientIds)].map((recipient) =>
        addDoc(collection(db, "notifications"), {
          recipientId: recipient,
          recipientRole:
            recipient === loan.applicantId && loan.applicantType === "cooperative"
              ? "arbo_head"
              : "arb",
          type,
          title,
          message,
          applicationId: null,
          loanId: loan.id,
          read: false,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
  };

  const sendReminder = async (loan: Loan) => {
    try {
      await notifyApplicant(
        loan,
        "payment_overdue",
        "Loan payment reminder",
        `Loan ${loan.id} has an overdue payment. Please contact the office if you need assistance.`,
      );
    } catch (reminderError) {
      console.error("Failed to send payment reminder:", reminderError);
      setError("Unable to send the payment reminder.");
    }
  };

  const approveLoan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLoan || !profile) return;
    const rate = Number(interestRate);
    if (
      !interestRate.trim() ||
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      setError("Enter a valid interest rate.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const approvalDate = new Date();
      const schedule = calculateLoanSchedule(
        selectedLoan.principalAmount,
        rate,
        selectedLoan.termMonths,
        selectedLoan.paymentFrequency,
        approvalDate,
      );
      const approvedAt = approvalDate.toISOString();
      const updates = {
        interestRate: rate,
        totalInterest: schedule.totalInterest,
        totalRepayment: schedule.totalRepayment,
        installmentAmount: schedule.installmentAmount,
        numberOfPayments: schedule.numberOfPayments,
        status: "active" as LoanStatus,
        accountStatus: "open" as const,
        totalPaid: 0,
        remainingBalance: schedule.totalRepayment,
        nextPaymentDue: schedule.schedule[0]?.dueDate || "",
        approvedBy: profile.uid,
        approvedByName: profile.name,
        approvedAt,
        startDate: approvedAt,
        notes: approvalNotes.trim(),
        updatedAt: approvedAt,
      };
      const batch = writeBatch(db);
      batch.update(loanRef(selectedLoan), updates);
      const paymentSchedules = buildPaymentSchedule(
        selectedLoan,
        rate,
        selectedLoan.termMonths,
        approvalDate,
      );
      paymentSchedules.forEach((item) => {
        const paymentRef = doc(collection(db, "loanPayments"));
        batch.set(paymentRef, {
          loanId: selectedLoan.id,
          ...item,
          amountPaid: 0,
          status: "upcoming",
          createdAt: approvedAt,
        });
      });
      await batch.commit();
      await writeAuditLog({
        actor: profile,
        action: "loan_approved",
        entityType: "loan",
        entityId: selectedLoan.id,
        oldStatus: selectedLoan.status,
        newStatus: "active",
        notes: `Admin ${profile.name} approved loan ${selectedLoan.id} at ${rate}% interest.${approvalNotes.trim() ? ` Notes: ${approvalNotes.trim()}` : ""}`,
      });
      try {
        await notifyApplicant(
          selectedLoan,
          "loan_approved",
          "Loan approved",
          `Your ${money(selectedLoan.principalAmount)} loan was approved at ${rate}% interest.`,
        );
      } catch (notificationError) {
        console.error("Loan approved but notification failed:", notificationError);
      }
      closeApprovalModal();
    } catch (approvalError) {
      console.error("Failed to approve loan:", approvalError);
      setError("Unable to approve the loan.");
    } finally {
      setSubmitting(false);
    }
  };

  const rejectLoan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLoan || !profile || !rejectionReason.trim()) {
      setError("Provide a rejection reason.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateDoc(loanRef(selectedLoan), {
        status: "rejected",
        rejectedReason: rejectionReason.trim(),
        previousRejectedReason: rejectionReason.trim(),
        updatedAt: new Date().toISOString(),
      });
      await writeAuditLog({
        actor: profile,
        action: "loan_rejected",
        entityType: "loan",
        entityId: selectedLoan.id,
        oldStatus: selectedLoan.status,
        newStatus: "rejected",
        notes: `Admin ${profile.name} rejected loan ${selectedLoan.id}: ${rejectionReason.trim()}`,
      });
      await notifyApplicant(
        selectedLoan,
        "loan_rejected",
        "Loan application rejected",
        rejectionReason.trim(),
      );
      setShowReject(false);
      setSelectedLoan(null);
      setRejectionReason("");
    } catch (rejectError) {
      console.error("Failed to reject loan:", rejectError);
      setError("Unable to reject the loan.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPayment = async (payment: LoanPayment) => {
    if (!profile) return;
    const loan = loans.find((item) => item.id === payment.loanId);
    if (!loan) return;
    try {
      const verifiedAt = new Date().toISOString();
      const fullyPaid = payment.amountPaid >= payment.amountDue;
      await updateDoc(doc(db, "loanPayments", payment.id), {
        status: fullyPaid ? "paid" : "partial",
        verifiedBy: profile.uid,
        verifiedByName: profile.name,
        verifiedAt,
      });
      if (payment.isEarlyRepayment && fullyPaid) {
        await Promise.all(
          payments
            .filter(
              (candidate) =>
                candidate.loanId === loan.id &&
                candidate.id !== payment.id &&
                candidate.memberId === payment.memberId &&
                ["upcoming", "overdue", "disputed"].includes(
                  candidate.status,
                ),
            )
            .map((candidate) =>
              updateDoc(doc(db, "loanPayments", candidate.id), {
                status: "paid",
                amountPaid: candidate.amountDue,
                paidAt: verifiedAt,
                verifiedBy: profile.uid,
                verifiedByName: profile.name,
                verifiedAt,
              }),
            ),
        );
      }
      if (!payment.verifiedAt) {
        const nextPayment = payments
          .filter(
            (candidate) =>
              candidate.loanId === loan.id &&
              candidate.id !== payment.id &&
              candidate.status === "upcoming" &&
              (!payment.isEarlyRepayment ||
                !fullyPaid ||
                candidate.memberId !== payment.memberId),
          )
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        const remainingBalance = Math.max(
          0,
          (loan.remainingBalance || loan.totalRepayment) - payment.amountPaid,
        );
        await updateDoc(loanRef(loan), {
          totalPaid: (loan.totalPaid || 0) + payment.amountPaid,
          remainingBalance,
          onTimePayments:
            (loan.onTimePayments || 0) +
            (fullyPaid && Date.now() <= new Date(payment.dueDate).getTime()
              ? 1
              : 0),
          nextPaymentDue: fullyPaid
            ? nextPayment?.dueDate || ""
            : payment.dueDate,
          ...(remainingBalance <= 0
            ? { status: "completed", accountStatus: "closed" }
            : {}),
          updatedAt: verifiedAt,
        });
        if (remainingBalance <= 0) {
          await notifyApplicant(
            loan,
            "loan_completed",
            "Loan completed",
            `Loan ${loan.id} has been fully paid and marked completed.`,
          );
        }
      }
      await writeAuditLog({
        actor: profile,
        action: "loan_payment_verified",
        entityType: "loan_payment",
        entityId: payment.id,
        applicationId: loan.id,
        oldStatus: payment.status,
        newStatus: fullyPaid ? "paid" : "partial",
        notes: `Admin ${profile.name} verified payment ${payment.paymentNumber} for loan ${loan.id}.`,
      });
      await notifyApplicant(
        loan,
        "payment_verified",
        "Payment verified",
        `Payment ${payment.paymentNumber} for ${loan.id} was verified.`,
        payment.memberId || payment.applicantId,
      );
      setSelectedPayment(null);
    } catch (paymentError) {
      console.error("Failed to update payment:", paymentError);
      setError("Unable to update the payment.");
    }
  };

  const disputePayment = async (payment: LoanPayment) => {
    if (!profile || !disputeNotes.trim()) {
      setError("Add notes explaining why this payment is disputed.");
      return;
    }
    const loan = loans.find((item) => item.id === payment.loanId);
    if (!loan) return;
    setSubmitting(true);
    setError(null);
    try {
      const disputedAt = new Date().toISOString();
      await updateDoc(doc(db, "loanPayments", payment.id), {
        status: "disputed",
        disputeReason: disputeNotes.trim(),
        lastDisputeReason: disputeNotes.trim(),
        disputedAt,
        disputedBy: profile.uid,
        verifiedBy: null,
        verifiedByName: null,
        verifiedAt: null,
      });
      await writeAuditLog({
        actor: profile,
        action: "loan_payment_disputed",
        entityType: "loan_payment",
        entityId: payment.id,
        applicationId: loan.id,
        oldStatus: payment.status,
        newStatus: "disputed",
        notes: `Admin ${profile.name} disputed payment ${payment.paymentNumber} for loan ${loan.id}: ${disputeNotes.trim()}`,
      });
      await notifyApplicant(
        loan,
        "payment_disputed",
        "Payment needs correction",
        `Payment ${payment.paymentNumber} for ${loan.id} was disputed: ${disputeNotes.trim()}`,
        payment.memberId || payment.applicantId,
      );
      setDisputeNotes("");
      setSelectedPayment(null);
    } catch (disputeError) {
      console.error("Failed to dispute payment:", disputeError);
      setError("Unable to dispute the payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentReview = (payment: LoanPayment) => {
    setSelectedPayment(payment);
    setDisputeNotes("");
    setError(null);
  };

  const markDefaulted = async (loan: Loan) => {
    if (!profile) return;
    try {
      await updateDoc(loanRef(loan), {
        status: "defaulted",
        accountStatus: "closed",
        updatedAt: new Date().toISOString(),
      });
      await writeAuditLog({
        actor: profile,
        action: "loan_defaulted",
        entityType: "loan",
        entityId: loan.id,
        oldStatus: loan.status,
        newStatus: "defaulted",
        notes: `Admin ${profile.name} marked loan ${loan.id} as defaulted.`,
      });
      await notifyApplicant(
        loan,
        "loan_defaulted",
        "Loan marked as defaulted",
        `Loan ${loan.id} has been marked as defaulted because of overdue payments.`,
      );
    } catch (defaultError) {
      console.error("Failed to mark loan defaulted:", defaultError);
      setError("Unable to update the loan status.");
    }
  };

  const completeLoan = async (loan: Loan) => {
    if (!profile) return;
    try {
      await updateDoc(loanRef(loan), {
        status: "completed",
        accountStatus: "closed",
        nextPaymentDue: "",
        updatedAt: new Date().toISOString(),
      });
      await writeAuditLog({
        actor: profile,
        action: "loan_completed",
        entityType: "loan",
        entityId: loan.id,
        oldStatus: loan.status,
        newStatus: "completed",
        notes: `Admin ${profile.name} closed loan ${loan.id}.`,
      });
      await notifyApplicant(
        loan,
        "loan_completed",
        "Loan closed",
        `Loan ${loan.id} was closed by the administrator.`,
      );
    } catch (closeError) {
      console.error("Failed to close loan:", closeError);
      setError("Unable to close the loan.");
    }
  };

  const editLoanTerms = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLoan || !profile) return;
    const rate = Number(editRate);
    const term = Number(editTerm);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isInteger(term) || term < 1) {
      setError("Enter a valid interest rate and term.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const schedule = calculateLoanSchedule(
        selectedLoan.principalAmount,
        rate,
        term,
        selectedLoan.paymentFrequency,
        new Date(selectedLoan.startDate || selectedLoan.createdAt),
      );
      const loanPayments = payments.filter(
        (payment) => payment.loanId === selectedLoan.id,
      );
      const paymentSchedules = buildPaymentSchedule(
        selectedLoan,
        rate,
        term,
        new Date(selectedLoan.startDate || selectedLoan.createdAt),
      );
      const owners = new Set([
        ...loanPayments.map((payment) => payment.memberId || payment.applicantId),
        ...paymentSchedules.map((payment) => payment.memberId || payment.applicantId),
      ]);
      for (const ownerId of owners) {
        const ownerPayments = loanPayments
          .filter(
            (payment) =>
              (payment.memberId || payment.applicantId) === ownerId,
          )
          .sort((a, b) => a.paymentNumber - b.paymentNumber);
        const completedCount = ownerPayments.filter(
          (payment) =>
            (payment.status === "paid" || payment.status === "partial") &&
            Boolean(payment.verifiedAt),
        ).length;
        const futurePayments = ownerPayments.filter(
          (payment) => payment.status === "upcoming",
        );
        const ownerSchedule = paymentSchedules
          .filter(
            (payment) =>
              (payment.memberId || payment.applicantId) === ownerId,
          )
          .slice(completedCount);

        await Promise.all(
          futurePayments
            .slice(0, ownerSchedule.length)
            .map((payment, index) =>
              updateDoc(doc(db, "loanPayments", payment.id), {
                ...ownerSchedule[index],
                amountPaid: 0,
                status: "upcoming",
              }),
            ),
        );
        await Promise.all(
          futurePayments.slice(ownerSchedule.length).map((payment) =>
            deleteDoc(doc(db, "loanPayments", payment.id)),
          ),
        );
        if (ownerSchedule.length > futurePayments.length) {
          await Promise.all(
            ownerSchedule
              .slice(futurePayments.length)
              .map((item) =>
                addDoc(collection(db, "loanPayments"), {
                  loanId: selectedLoan.id,
                  ...item,
                  amountPaid: 0,
                  status: "upcoming",
                  createdAt: new Date().toISOString(),
                }),
              ),
          );
        }
      }
      const nextPaymentDue = Array.from(owners)
        .flatMap((ownerId) => {
          const completedCount = loanPayments.filter(
            (payment) =>
              (payment.memberId || payment.applicantId) === ownerId &&
              (payment.status === "paid" || payment.status === "partial") &&
              Boolean(payment.verifiedAt),
          ).length;
          return paymentSchedules
            .filter(
              (payment) =>
                (payment.memberId || payment.applicantId) === ownerId,
            )
            .slice(completedCount)
            .map((payment) => payment.dueDate);
        })
        .sort()[0] || "";
      await updateDoc(loanRef(selectedLoan), {
        interestRate: rate,
        termMonths: term,
        totalInterest: schedule.totalInterest,
        totalRepayment: schedule.totalRepayment,
        installmentAmount: schedule.installmentAmount,
        numberOfPayments: schedule.numberOfPayments,
        remainingBalance: Math.max(
          0,
          schedule.totalRepayment - selectedLoan.totalPaid,
        ),
        nextPaymentDue,
        updatedAt: new Date().toISOString(),
      });
      await writeAuditLog({
        actor: profile,
        action: "loan_terms_updated",
        entityType: "loan",
        entityId: selectedLoan.id,
        oldStatus: selectedLoan.status,
        newStatus: selectedLoan.status,
        notes: `Admin ${profile.name} changed loan ${selectedLoan.id} to ${rate}% interest over ${term} months.`,
      });
      setShowEditTerms(false);
      setSelectedLoan(null);
    } catch (editError) {
      console.error("Failed to edit loan terms:", editError);
      setError("Unable to update loan terms.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditTerms = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditRate(String(loan.interestRate));
    setEditTerm(String(loan.termMonths));
    setError(null);
    setShowEditTerms(true);
  };

  const exportReport = () => {
    exportToCSV(
      "loan-profitability-report",
      ["id", "applicantName", "principalAmount", "totalInterest", "totalPaid", "remainingBalance", "status"],
      loans.map((loan) => ({
        id: loan.id,
        applicantName: loan.applicantName,
        principalAmount: loan.principalAmount,
        totalInterest: loan.totalInterest,
        totalPaid: loan.totalPaid,
        remainingBalance: loan.remainingBalance,
        status: LOAN_STATUS_CONFIG[loan.status].label,
      })),
    );
  };

  const openApprovalModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setInterestRate("");
    setApprovalNotes("");
    setError(null);
    setShowApproval(true);
  };

  const closeApprovalModal = () => {
    setShowApproval(false);
    setSelectedLoan(null);
    setInterestRate("");
    setApprovalNotes("");
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 grid place-items-center"><p className="text-sm text-slate-500">Loading loan management...</p></main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Admin Finance</p>
              <h1 className="text-2xl font-bold text-slate-900">Loan Management</h1>
              <p className="text-sm text-slate-500">Review applications, verify payments, and monitor portfolio performance.</p>
            </div>
            <button onClick={exportReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Download size={15} /> Export Report</button>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Total Loans" value={String(loans.length)} icon={<FileText size={17} />} />
            <Kpi label="Capital Deployed" value={money(totalPrincipal)} icon={<BarChart3 size={17} />} />
            <Kpi label="Outstanding" value={money(activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0))} icon={<Landmark size={17} />} />
            <Kpi label="Active Loans" value={String(activeLoans.length)} icon={<ShieldAlert size={17} />} />
            <Kpi label="Collection Rate" value={`${collectionRate.toFixed(1)}%`} icon={<CheckCircle size={17} />} />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200">
            {[
              ["pending", `Pending (${pendingLoans.length})`],
              ["active", "Active Loans"],
              ["payments", `Payments (${reviewPayments.length})`],
              ["defaulters", `Defaulters (${defaulterLoans.length})`],
              ["reports", "Profitability"],
              ["archive", "Archive"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id as TabId)} className={`border-b-2 px-3 py-3 text-xs font-bold ${activeTab === id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}>{label}</button>
            ))}
          </div>

          {activeTab === "reports" ? (
            <ProfitabilityReport
              loans={loans}
              incomeExpenses={incomeExpenses}
              borrowers={borrowers}
              payments={payments}
            />
          ) : activeTab === "payments" ? (
            <PaymentsTable payments={reviewPayments} loans={loans} onSelect={openPaymentReview} />
          ) : activeTab === "defaulters" ? (
            <DefaultersTable
              loans={defaulterLoans}
              payments={payments}
              onReminder={(loan) => void sendReminder(loan)}
              onDefault={(loan) => void markDefaulted(loan)}
            />
          ) : (
            <div className="space-y-3">
              <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loan ID, applicant, or purpose" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-600" /></div>
              {filteredLoans.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">No loans in this view.</div>}
              {filteredLoans.map((loan) => (
                <LoanRow
                  key={loan.id}
                  loan={loan}
                  payments={payments.filter((payment) => payment.loanId === loan.id)}
                  expanded={expandedLoanId === loan.id}
                  onExpand={() =>
                    setExpandedLoanId(
                      expandedLoanId === loan.id ? null : loan.id,
                    )
                  }
                  onApprove={() => {
                    openApprovalModal(loan);
                  }}
                  onReject={() => {
                    setSelectedLoan(loan);
                    setError(null);
                    setShowReject(true);
                  }}
                  onDefault={() => void markDefaulted(loan)}
                  onEdit={() => openEditTerms(loan)}
                  onComplete={() => void completeLoan(loan)}
                />
              ))}
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
        </div>
      </main>

      {showApproval && selectedLoan && (
        <Modal title="Approve Loan" onClose={closeApprovalModal}>
          <form onSubmit={approveLoan} className="space-y-4">
            <Info loan={selectedLoan} />
            <label className="block text-xs font-bold text-slate-600">Interest rate (%)
              <input type="number" min="0" step="0.01" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-bold text-slate-600">Approval notes
              <textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <SubmitButton loading={submitting} label="Approve & Generate Schedule" />
          </form>
        </Modal>
      )}
      {showReject && selectedLoan && (
        <Modal title="Reject Loan" onClose={() => setShowReject(false)}>
          <form onSubmit={rejectLoan} className="space-y-4">
            <Info loan={selectedLoan} />
            <label className="block text-xs font-bold text-slate-600">Reason
              <textarea required value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <SubmitButton loading={submitting} label="Reject Application" />
          </form>
        </Modal>
      )}
      {showEditTerms && selectedLoan && (
        <Modal title="Edit Active Loan Terms" onClose={() => setShowEditTerms(false)}>
          <form onSubmit={editLoanTerms} className="space-y-4">
            <Info loan={selectedLoan} />
            <label className="block text-xs font-bold text-slate-600">
              Interest rate (%)
              <input
                type="number"
                min="0"
                step="0.01"
                value={editRate}
                onChange={(event) => setEditRate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Term (months)
              <input
                type="number"
                min="1"
                value={editTerm}
                onChange={(event) => setEditTerm(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
            <SubmitButton loading={submitting} label="Save & Recalculate Future Payments" />
          </form>
        </Modal>
      )}
      {selectedPayment && (
        <Modal title="Review Payment" onClose={() => setSelectedPayment(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Payment {selectedPayment.paymentNumber} for <b>{selectedPayment.loanId}</b></p>
            <div className="grid grid-cols-2 gap-3"><Kpi label="Due" value={money(selectedPayment.amountDue)} icon={<FileText size={15} />} /><Kpi label="Paid" value={money(selectedPayment.amountPaid)} icon={<CheckCircle size={15} />} /></div>
            {selectedPayment.receiptImage ? <img src={selectedPayment.receiptImage} alt="Payment receipt" className="max-h-72 w-full rounded-lg object-contain" /> : <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No receipt image attached.</p>}
            {(selectedPayment.receiptNotes || selectedPayment.resubmissionNotes) && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-bold text-slate-700">Applicant notes</p>
                <p className="mt-1">{selectedPayment.resubmissionNotes || selectedPayment.receiptNotes}</p>
              </div>
            )}
            {(selectedPayment.disputeReason || selectedPayment.lastDisputeReason) && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                <p className="font-bold">Previous dispute reason</p>
                <p className="mt-1">{selectedPayment.disputeReason || selectedPayment.lastDisputeReason}</p>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-600">
              Dispute notes
              <textarea
                value={disputeNotes}
                onChange={(event) => setDisputeNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Example: Receipt is blurred or does not match the payment."
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => void verifyPayment(selectedPayment)} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Check size={14} className="mr-1 inline" /> Verify</button>
              <button disabled={submitting} onClick={() => void disputePayment(selectedPayment)} className="flex-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><AlertTriangle size={14} className="mr-1 inline" /> Dispute with Notes</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2 flex items-center gap-2 text-emerald-700">{icon}<span className="text-[10px] font-bold uppercase text-slate-400">{label}</span></div><p className="text-lg font-extrabold text-slate-900">{value}</p></div>;

const LoanRow: React.FC<{
  loan: Loan;
  payments: LoanPayment[];
  expanded: boolean;
  onExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDefault: () => void;
  onEdit: () => void;
  onComplete: () => void;
}> = ({
  loan,
  payments,
  expanded,
  onExpand,
  onApprove,
  onReject,
  onDefault,
  onEdit,
  onComplete,
}) => {
  const status = LOAN_STATUS_CONFIG[loan.status];
  const scheduledPayments = payments.filter(
    (payment) => !payment.isEarlyRepayment,
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button onClick={onExpand} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <div>
          <p className="text-xs font-bold text-emerald-800">{loan.id}</p>
          <h2 className="font-bold text-slate-900">{loan.applicantName}</h2>
          <p className="text-xs text-slate-500">
            {loan.purpose} · {money(loan.principalAmount)} ·{" "}
            {FREQUENCY_LABELS[loan.paymentFrequency]}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Created {formatDate(loan.createdAt)}</span>
          <span>{loan.termMonths} months</span>
          {loan.hasHistoryFlag && <span className="font-bold text-orange-700">History flag</span>}
        </div>
        <div className="flex gap-2">
          {(loan.status === "pending_approval" || loan.status === "needs_review") && (
            <>
              <button onClick={onApprove} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[10px] font-bold text-white">Approve</button>
              <button onClick={onReject} className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white">Reject</button>
            </>
          )}
          {loan.status === "active" && (
            <>
              <button onClick={onEdit} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[10px] font-bold text-slate-700">Edit Terms</button>
              <button onClick={onComplete} className="rounded-lg border border-blue-200 px-3 py-1.5 text-[10px] font-bold text-blue-700">Close Loan</button>
              <button onClick={onDefault} className="rounded-lg border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-700">Mark Default</button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-400">
              <tr><th className="p-2">#</th><th className="p-2">Due</th><th className="p-2">Due Amount</th><th className="p-2">Paid</th><th className="p-2">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...scheduledPayments].sort((a, b) => a.paymentNumber - b.paymentNumber).map((payment) => {
                const paymentStatus = PAYMENT_STATUS_CONFIG[payment.status];
                return <tr key={payment.id}><td className="p-2">{payment.paymentNumber}</td><td className="p-2">{formatDate(payment.dueDate)}</td><td className="p-2">{money(payment.amountDue)}</td><td className="p-2">{money(payment.amountPaid)}</td><td className="p-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${paymentStatus.bgColor} ${paymentStatus.color}`}>{paymentStatus.label}</span>{payment.receiptImage && <a className="ml-2 text-emerald-700 underline" href={payment.receiptImage} target="_blank" rel="noreferrer">Receipt</a>}</td></tr>;
              })}
              {scheduledPayments.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No payment schedule.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PaymentsTable: React.FC<{ payments: LoanPayment[]; loans: Loan[]; onSelect: (payment: LoanPayment) => void }> = ({ payments, loans, onSelect }) => <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th className="p-3">Loan</th><th className="p-3">Applicant</th><th className="p-3">Due</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => { const loan = loans.find((item) => item.id === payment.loanId); const status = PAYMENT_STATUS_CONFIG[payment.status]; return <tr key={payment.id}><td className="p-3 font-bold">{payment.loanId}</td><td className="p-3">{loan?.applicantName || "—"}</td><td className="p-3">{formatDate(payment.dueDate)}</td><td className="p-3 font-bold">{money(payment.amountDue)}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${status.bgColor} ${status.color}`}>{status.label}</span></td><td className="p-3 text-right"><button onClick={() => onSelect(payment)} className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-white">Review</button></td></tr>; })}{payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No overdue or disputed payments.</td></tr>}</tbody></table></div>;

const DefaultersTable: React.FC<{
  loans: Loan[];
  payments: LoanPayment[];
  onReminder: (loan: Loan) => void;
  onDefault: (loan: Loan) => void;
}> = ({ loans, payments, onReminder, onDefault }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th className="p-3">Borrower</th><th className="p-3">Loan</th><th className="p-3">Overdue Since</th><th className="p-3">Amount</th><th className="p-3">Defaults</th><th className="p-3"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {loans.map((loan) => {
          const overdue = payments.filter((payment) => payment.loanId === loan.id && payment.status === "overdue");
          const firstOverdue = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
          return <tr key={loan.id}><td className="p-3 font-bold">{loan.applicantName}</td><td className="p-3">{loan.id}</td><td className="p-3">{firstOverdue ? formatDate(firstOverdue.dueDate) : "—"}</td><td className="p-3 font-bold">{money(overdue.reduce((sum, payment) => sum + payment.amountDue, 0))}</td><td className="p-3">{loan.defaultedPayments}</td><td className="p-3 text-right"><button onClick={() => onReminder(loan)} className="mr-1 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white">Send Reminder</button><button onClick={() => onDefault(loan)} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Mark Defaulted</button></td></tr>;
        })}
        {loans.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No defaulters.</td></tr>}
      </tbody>
    </table>
  </div>
);

const ProfitabilityReport: React.FC<{
  loans: Loan[];
  incomeExpenses: LoanIncomeExpense[];
  borrowers: BorrowerProfile[];
  payments: LoanPayment[];
}> = ({ loans, incomeExpenses, borrowers, payments }) => {
  const rows = borrowers.map((borrower) => {
    const entries = incomeExpenses.filter((entry) => entry.userId === borrower.uid);
    const income = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
    const balance = loans.filter((loan) => loan.applicantId === borrower.uid && loan.status === "active").reduce((sum, loan) => sum + loan.remainingBalance, 0);
    return { borrower, income, expenses, net: income - expenses, balance };
  }).sort((a, b) => a.net - b.net);
  const totalIncome = rows.reduce((sum, row) => sum + row.income, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.expenses, 0);
  const verified = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amountPaid, 0);
  return <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Kpi label="ARB Income" value={money(totalIncome)} icon={<BarChart3 size={17} />} /><Kpi label="ARB Expenses" value={money(totalExpenses)} icon={<FileText size={17} />} /><Kpi label="Verified Collections" value={money(verified)} icon={<CheckCircle size={17} />} /></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th className="p-3">ARB</th><th className="p-3">Income</th><th className="p-3">Expenses</th><th className="p-3">Net</th><th className="p-3">Active Loan Balance</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.borrower.uid}><td className="p-3 font-bold">{row.borrower.name}</td><td className="p-3">{money(row.income)}</td><td className="p-3">{money(row.expenses)}</td><td className={`p-3 font-bold ${row.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(row.net)}</td><td className="p-3">{money(row.balance)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No ARB financial data.</td></tr>}</tbody></table></div></div>;
};

const Info: React.FC<{ loan: Loan }> = ({ loan }) => (
  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
    <p>
      <b>{loan.applicantName}</b> requested <b>{money(loan.principalAmount)}</b>
    </p>
    <p className="mt-1">
      {loan.purpose} · {loan.termMonths} months ·{" "}
      {FREQUENCY_LABELS[loan.paymentFrequency]}
    </p>
    {loan.applicantType === "cooperative" &&
      loan.memberAllocations &&
      loan.memberAllocations.length > 0 && (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
          <p className="font-bold text-indigo-700">Member allocation</p>
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-indigo-50 text-[10px] uppercase tracking-wide text-indigo-700">
                <tr>
                  <th className="px-3 py-2">Participant</th>
                  <th className="px-3 py-2 text-right">Allocated share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.memberAllocations.map((allocation) => (
                  <tr key={allocation.memberId} className="bg-white">
                    <td className="px-3 py-2 text-slate-600">
                      {allocation.memberName}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        allocation.amount === 0
                          ? "text-slate-400"
                          : "text-slate-800"
                      }`}
                    >
                      {money(allocation.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    {loan.historyNotes && (
      <p className="mt-2 font-semibold text-orange-700">{loan.historyNotes}</p>
    )}
    {loan.resubmissionNotes && (
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
        <p className="font-bold">Applicant resubmission notes</p>
        <p className="mt-1">{loan.resubmissionNotes}</p>
      </div>
    )}
    {loan.previousRejectedReason && (
      <p className="mt-2 text-red-700">
        <b>Previous rejection:</b> {loan.previousRejectedReason}
      </p>
    )}
  </div>
);
const SubmitButton: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => <button disabled={loading} className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Saving..." : label}</button>;
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">{title}</h2><button onClick={onClose} className="text-slate-400"><X size={18} /></button></div><div className="p-5">{children}</div></div></div>;
