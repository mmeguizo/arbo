import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { broadcastNotification } from "../contexts/NotificationContext";
import { formatDate } from "../utils/formatters";
import { getDocumentPath, uploadFile } from "../utils/storage";
import { writeAuditLog } from "../utils/audit";
import {
  AlertCircle,
  CheckCircle2,
  Percent,
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Landmark,
  Loader2,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  FREQUENCY_LABELS,
  INCOME_CATEGORIES,
  LOAN_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  checkLoanHistory,
  generateLoanId,
  type Loan,
  type LoanIncomeExpense,
  type LoanPayment,
  type PaymentFrequency,
} from "../types/loan";

type TabId = "loans" | "income_expenses";

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const canManageLoanPayment = (
  loan: Loan | undefined,
  payment: LoanPayment,
  uid: string,
) =>
  loan?.applicantType === "cooperative"
    ? payment.memberId === uid
    : payment.applicantId === uid;

const isPaymentPendingVerification = (payment: LoanPayment) =>
  (payment.status === "paid" || payment.status === "partial") &&
  !payment.verifiedAt &&
  (payment.amountPaid > 0 || Boolean(payment.paidAt));

const calculateOwnedBalance = (
  loan: Loan,
  payments: LoanPayment[],
  uid: string,
) =>
  payments
    .filter(
      (payment) =>
        payment.loanId === loan.id &&
        !payment.isEarlyRepayment &&
        canManageLoanPayment(loan, payment, uid),
    )
    .reduce(
      (balance, payment) =>
        balance +
        Math.max(
          0,
          payment.amountDue -
            (payment.verifiedAt ? payment.amountPaid : 0),
        ),
      0,
    );

export const LoanApplication: React.FC = () => {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [managedCooperative, setManagedCooperative] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [memberCooperativeIds, setMemberCooperativeIds] = useState<string[]>(
    [],
  );
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [incomeExpenses, setIncomeExpenses] = useState<LoanIncomeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("loans");
  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState<
    "all" | "active" | "pending" | "completed"
  >("all");
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("all");
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [resubmittingLoan, setResubmittingLoan] = useState<Loan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForLoan, setPaymentForLoan] = useState<string | null>(null);
  const [paymentForEntry, setPaymentForEntry] = useState<LoanPayment | null>(
    null,
  );
  const [earlyRepaymentLoan, setEarlyRepaymentLoan] = useState<Loan | null>(
    null,
  );
  const [earlyRepaymentAmount, setEarlyRepaymentAmount] = useState("");
  const [earlyRepaymentReceipt, setEarlyRepaymentReceipt] =
    useState<File | null>(null);
  const [earlyRepaymentNotes, setEarlyRepaymentNotes] = useState("");
  const [showIncomeExpenseModal, setShowIncomeExpenseModal] = useState(false);
  const [applyDirectlyToLoan, setApplyDirectlyToLoan] = useState(false);
  const [incomeTargetLoanId, setIncomeTargetLoanId] = useState("");
  const [incomeApplyAmount, setIncomeApplyAmount] = useState("");
  const [selectedIncomeForPayment, setSelectedIncomeForPayment] = useState<LoanIncomeExpense | null>(null);
  const [applyIncomeTargetLoanId, setApplyIncomeTargetLoanId] = useState("");
  const [applyIncomeAmount, setApplyIncomeAmount] = useState("");
  const [applyIncomeNotes, setApplyIncomeNotes] = useState("");
  const [showApplyIncomeModal, setShowApplyIncomeModal] = useState(false);
  const [selectedLedgerLoanId, setSelectedLedgerLoanId] = useState("all");
  const [incomeExpenseType, setIncomeExpenseType] = useState<
    "income" | "expense"
  >("income");
  const [formPurpose, setFormPurpose] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTerm, setFormTerm] = useState("12");
  const [formFrequency, setFormFrequency] =
    useState<PaymentFrequency>("monthly");
  const [formNotes, setFormNotes] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payReceipt, setPayReceipt] = useState<File | null>(null);
  const [payNotes, setPayNotes] = useState("");
  const [ieCategory, setIeCategory] = useState("");
  const [ieDescription, setIeDescription] = useState("");
  const [ieAmount, setIeAmount] = useState("");
  const [ieDate, setIeDate] = useState(new Date().toISOString().slice(0, 10));
  const [ieReceipt, setIeReceipt] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notificationKeys = useRef(new Set<string>());
  const isCooperativeApplication =
    profile?.role === "arbo_head" &&
    searchParams.get("type") === "cooperative";
  const cooperativeId = managedCooperative?.id || profile?.arboId || "";
  const cooperativeName =
    managedCooperative?.name ||
    (isCooperativeApplication ? "My ARBO Cooperative" : "");

  useEffect(() => {
    if (!profile || profile.role !== "arbo_head") return;
    return onSnapshot(
      query(collection(db, "cooperatives"), where("headId", "==", profile.uid)),
      (snap) => {
        const cooperative = snap.docs[0];
        if (!cooperative) return;
        setManagedCooperative({
          id: cooperative.id,
          name: String(cooperative.data().name || "My ARBO Cooperative"),
        });
      },
      (error) => console.error("Failed to load managed cooperative:", error),
    );
  }, [profile]);

  useEffect(() => {
    if (!profile || !user) return;

    return onSnapshot(
      query(
        collection(db, "cooperativeMembers"),
        where("userId", "==", user.uid),
      ),
      (snap) => {
        setMemberCooperativeIds(
          snap.docs
            .map((item) => String(item.data().cooperativeId || ""))
            .filter(Boolean),
        );
      },
      (error) => {
        console.error("Failed to load cooperative memberships:", error);
        setMemberCooperativeIds([]);
      },
    );
  }, [profile, user]);

  useEffect(() => {
    if (!profile || !user) return;

    const unsubLoans = onSnapshot(
      collection(db, "loans"),
      (snap) => {
        const cooperativeIds = new Set([
          ...memberCooperativeIds,
          profile.arboId || "",
          managedCooperative?.id || "",
        ]);
        const visibleLoans = snap.docs
          .map(
            (item) =>
              ({
                ...item.data(),
                id: String(item.data().id || item.id),
                firestoreId: item.id,
              }) as Loan,
          )
          .filter(
            (loan) =>
              loan.applicantId === user.uid ||
              (loan.applicantType === "cooperative" &&
                Boolean(loan.cooperativeId) &&
                cooperativeIds.has(loan.cooperativeId || "")),
          );
        setLoans(visibleLoans);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load loans:", error);
        setLoading(false);
      },
    );
    const unsubLedger = onSnapshot(
      query(collection(db, "loanIncomeExpenses"), where("userId", "==", user.uid)),
      (snap) =>
        setIncomeExpenses(
          snap.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as LoanIncomeExpense,
          ),
        ),
    );

    return () => {
      unsubLoans();
      unsubLedger();
    };
  }, [managedCooperative?.id, memberCooperativeIds, profile, user]);

  useEffect(() => {
    if (!profile || !user) return;
    const visibleLoanIds = new Set(loans.map((loan) => loan.id));
    return onSnapshot(
      collection(db, "loanPayments"),
      (snap) =>
        setPayments(
          snap.docs
            .map(
              (item) =>
                ({
                  ...item.data(),
                  id: item.id,
                }) as LoanPayment,
            )
            .filter(
              (payment) =>
                payment.applicantId === user.uid ||
                visibleLoanIds.has(payment.loanId),
            ),
        ),
      (error) => console.error("Failed to load loan payments:", error),
    );
  }, [loans, profile, user]);

  useEffect(() => {
    if (!profile) return;
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;

    payments.forEach((payment) => {
      if (payment.status !== "upcoming") return;
      const paymentLoan = loans.find((loan) => loan.id === payment.loanId);
      if (!canManageLoanPayment(paymentLoan, payment, profile.uid)) return;
      const due = new Date(payment.dueDate).getTime();
      if (Number.isNaN(due)) return;
      const key = `${payment.id}:${payment.status}`;

      if (due < now) {
        void updateDoc(doc(db, "loanPayments", payment.id), {
          status: "overdue",
        });
        if (!notificationKeys.current.has(key)) {
          notificationKeys.current.add(key);
          void addDoc(collection(db, "notifications"), {
            recipientId: profile.uid,
            recipientRole: profile.role,
            type: "payment_overdue",
            title: "Loan payment overdue",
            message: `Payment ${payment.paymentNumber} for loan ${payment.loanId} is overdue.`,
            applicationId: null,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (due - now <= week && !notificationKeys.current.has(key)) {
        notificationKeys.current.add(key);
        void addDoc(collection(db, "notifications"), {
          recipientId: profile.uid,
          recipientRole: profile.role,
          type: "payment_due_soon",
          title: "Loan payment due soon",
          message: `Payment ${payment.paymentNumber} for loan ${payment.loanId} is due on ${formatDate(payment.dueDate)}.`,
          applicationId: null,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }, [payments, profile]);

  const allPersonalLoans = useMemo(
    () =>
      loans.filter(
        (loan) =>
          loan.applicantId === user?.uid && loan.applicantType === "individual",
      ),
    [loans, user?.uid],
  );
  const allCooperativeLoans = useMemo(
    () => loans.filter((loan) => loan.applicantType === "cooperative"),
    [loans],
  );
  const relevantLoans = useMemo(
    () => (isCooperativeApplication ? allCooperativeLoans : allPersonalLoans),
    [isCooperativeApplication, allCooperativeLoans, allPersonalLoans],
  );
  const matchesLoanFilters = (loan: Loan) => {
    const term = loanSearch.trim().toLowerCase();
    const matchesSearch =
      !term ||
      loan.id.toLowerCase().includes(term) ||
      loan.purpose.toLowerCase().includes(term);
    const matchesStatus =
      loanStatusFilter === "all" ||
      (loanStatusFilter === "pending" &&
        ["pending_approval", "needs_review"].includes(loan.status)) ||
      loan.status === loanStatusFilter;
    return matchesSearch && matchesStatus;
  };
  const filteredPersonalLoans = useMemo(
    () =>
      allPersonalLoans
        .filter(matchesLoanFilters)
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        ),
    [allPersonalLoans, loanSearch, loanStatusFilter],
  );
  const filteredCooperativeLoans = useMemo(
    () =>
      allCooperativeLoans
        .filter(matchesLoanFilters)
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        ),
    [allCooperativeLoans, loanSearch, loanStatusFilter],
  );
  const activePersonalLoans = allPersonalLoans.filter(
    (loan) => loan.status === "active",
  );
  const heroLoan = [...activePersonalLoans].sort(
    (a, b) =>
      new Date(a.nextPaymentDue || "9999-12-31").getTime() -
      new Date(b.nextPaymentDue || "9999-12-31").getTime(),
  )[0];
  const heroPayments = heroLoan
    ? payments
        .filter(
          (payment) =>
            payment.loanId === heroLoan.id && !payment.isEarlyRepayment,
        )
        .sort((a, b) => a.paymentNumber - b.paymentNumber)
    : [];
  const heroNextPayment =
    heroPayments.find(
      (payment) => payment.status === "upcoming" || payment.status === "overdue",
    ) || null;
  const heroPaidInstallments = heroPayments.filter(
    (payment) => payment.status === "paid" && payment.verifiedAt,
  ).length;
  const heroProgress =
    heroLoan && heroLoan.totalRepayment > 0
      ? Math.min(100, Math.round((heroLoan.totalPaid / heroLoan.totalRepayment) * 100))
      : 0;
  const lifetimeBorrowed = allPersonalLoans.reduce(
    (sum, loan) => sum + (loan.principalAmount || 0),
    0,
  );
  const lifetimeRepaid = allPersonalLoans.reduce(
    (sum, loan) => sum + (loan.totalPaid || 0),
    0,
  );
  const completedPersonalLoans = allPersonalLoans.filter(
    (loan) => loan.status === "completed",
  ).length;
  const totalIncome = useMemo(
    () =>
      incomeExpenses
        .filter((entry) => entry.type === "income")
        .reduce((sum, entry) => sum + entry.amount, 0),
    [incomeExpenses],
  );
  const totalExpenses = useMemo(
    () =>
      incomeExpenses
        .filter((entry) => entry.type === "expense")
        .reduce((sum, entry) => sum + entry.amount, 0),
    [incomeExpenses],
  );
  const netProfit = totalIncome - totalExpenses;
  const selectedLedgerEntries =
    selectedLedgerLoanId === "all"
      ? incomeExpenses
      : incomeExpenses.filter(
          (entry) => entry.loanId === selectedLedgerLoanId,
        );
  const visibleLedgerEntries =
    ledgerCategoryFilter === "all"
      ? selectedLedgerEntries
      : selectedLedgerEntries.filter(
          (entry) => entry.category === ledgerCategoryFilter,
        );
  const ledgerCategoryOptions = useMemo(
    () =>
      Array.from(new Set(incomeExpenses.map((entry) => entry.category))).sort(),
    [incomeExpenses],
  );
  const visibleLedgerIncome = visibleLedgerEntries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const visibleLedgerExpenses = visibleLedgerEntries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const displayedNetProfit =
    activeTab === "income_expenses"
      ? visibleLedgerIncome - visibleLedgerExpenses
      : netProfit;

  // Scoped loan metrics dynamically reacting to selectedLedgerLoanId filter
  const scopedLoans = useMemo(() => {
    if (selectedLedgerLoanId !== "all") {
      const match = relevantLoans.filter((loan) => loan.id === selectedLedgerLoanId);
      if (match.length > 0) return match;
      return loans.filter((loan) => loan.id === selectedLedgerLoanId);
    }
    return relevantLoans;
  }, [relevantLoans, loans, selectedLedgerLoanId]);

  const scopedActiveLoansCount = useMemo(
    () => scopedLoans.filter((loan) => loan.status === "active").length,
    [scopedLoans],
  );

  const scopedTotalOutstanding = useMemo(
    () =>
      scopedLoans
        .filter((loan) => loan.status === "active")
        .reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0),
    [scopedLoans],
  );

  const scopedTotalObligation = useMemo(
    () =>
      scopedLoans.reduce(
        (sum, loan) =>
          sum + (loan.totalRepayment || (loan.principalAmount + (loan.totalInterest || 0))),
        0,
      ),
    [scopedLoans],
  );

  const scopedNextDuePayment = useMemo(() => {
    const activeScopedLoanIds = new Set(
      scopedLoans.filter((loan) => loan.status === "active").map((l) => l.id),
    );
    const upcoming = payments
      .filter(
        (payment) =>
          activeScopedLoanIds.has(payment.loanId) &&
          (payment.status === "upcoming" || payment.status === "overdue") &&
          canManageLoanPayment(
            loans.find((l) => l.id === payment.loanId),
            payment,
            profile?.uid || "",
          ),
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
    return upcoming[0] || null;
  }, [scopedLoans, payments, loans, profile?.uid]);

  // Loan Profitability / ROI Status Card (Net Profit / Total Loan Obligation)
  const profitabilityMetrics = useMemo(() => {
    if (scopedTotalObligation <= 0) {
      return {
        formattedRatio: "N/A",
        label: "No Active Loan",
        color: "text-slate-500",
        bgColor: "bg-slate-50 text-slate-600 border-slate-200",
        positive: true,
      };
    }
    const ratio = Math.round((displayedNetProfit / scopedTotalObligation) * 100);
    const formattedRatio = `${ratio >= 0 ? "+" : ""}${ratio}%`;
    if (displayedNetProfit >= scopedTotalObligation) {
      return {
        formattedRatio,
        label: "Profitable",
        color: "text-emerald-700",
        bgColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
        positive: true,
      };
    }
    if (displayedNetProfit > 0) {
      return {
        formattedRatio,
        label: "Recovering / On Track",
        color: "text-amber-700",
        bgColor: "bg-amber-50 text-amber-800 border-amber-200",
        positive: true,
      };
    }
    return {
      formattedRatio,
      label: "Deficit / Unprofitable",
      color: "text-red-700",
      bgColor: "bg-red-50 text-red-700 border-red-200",
      positive: false,
    };
  }, [displayedNetProfit, scopedTotalObligation]);

  const openPaymentModal = (loan: Loan, payment: LoanPayment) => {
    if (!profile || !canManageLoanPayment(loan, payment, profile.uid)) return;
    setPaymentForLoan(loan.id);
    setPaymentForEntry(payment);
    setPayAmount(String(payment.amountPaid || payment.amountDue));
    setPayReceipt(null);
    setPayNotes("");
    setFormError(null);
    setShowPaymentModal(true);
  };

  const openResubmissionModal = (loan: Loan) => {
    if (loan.applicantType === "cooperative") return;
    setResubmittingLoan(loan);
    setFormPurpose(loan.purpose);
    setFormAmount(String(loan.principalAmount));
    setFormTerm(String(loan.termMonths));
    setFormFrequency(loan.paymentFrequency);
    setFormNotes("");
    setFormError(null);
    setShowApplyModal(true);
  };

  const closeApplicationModal = () => {
    setShowApplyModal(false);
    setResubmittingLoan(null);
    setFormNotes("");
  };

  const handleApply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !user) return;
    const amount = Number(formAmount);
    const term = Number(formTerm);
    if (!formPurpose.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a valid amount and loan purpose.");
      return;
    }
    if (!Number.isInteger(term) || term < 1) {
      setFormError("Term must be at least one month.");
      return;
    }
    if (resubmittingLoan && !formNotes.trim()) {
      setFormError("Add notes explaining how you addressed the rejection.");
      return;
    }
    if (isCooperativeApplication && !cooperativeId) {
      setFormError(
        "Your ARBO is not linked to this account yet. Ask an administrator to link the cooperative before applying.",
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const existing = await getDocs(
        query(collection(db, "loans"), where("applicantId", "==", profile.uid)),
      );
      const history = checkLoanHistory(
        existing.docs.map(
          (item) =>
            ({
              ...item.data(),
              id: String(item.data().id || item.id),
              firestoreId: item.id,
            }) as Loan,
        ),
      );
      const now = new Date().toISOString();
      if (resubmittingLoan) {
        await updateDoc(
          doc(db, "loans", resubmittingLoan.firestoreId || resubmittingLoan.id),
          {
            principalAmount: amount,
            termMonths: term,
            paymentFrequency: formFrequency,
            purpose: formPurpose.trim(),
            totalInterest: 0,
            totalRepayment: amount,
            installmentAmount: 0,
            numberOfPayments: 0,
            status: resubmittingLoan.hasHistoryFlag
              ? "needs_review"
              : "pending_approval",
            rejectedReason: null,
            previousRejectedReason:
              resubmittingLoan.rejectedReason ||
              resubmittingLoan.previousRejectedReason ||
              null,
            resubmissionNotes: formNotes.trim(),
            resubmittedAt: now,
            notes: formNotes.trim(),
            updatedAt: now,
          },
        );
        await writeAuditLog({
          actor: { uid: user.uid, name: profile.name, role: profile.role },
          action: "loan_resubmitted",
          entityType: "loan",
          entityId: resubmittingLoan.id,
          oldStatus: "rejected",
          newStatus: resubmittingLoan.hasHistoryFlag
            ? "needs_review"
            : "pending_approval",
          notes: `${profile.name} resubmitted loan ${resubmittingLoan.id}. Notes: ${formNotes.trim()}`,
        });
      } else {
        const loanId = generateLoanId();
        await addDoc(collection(db, "loans"), {
          id: loanId,
          applicantId: profile.uid,
          applicantName: profile.name,
          applicantType: isCooperativeApplication ? "cooperative" : "individual",
          cooperativeId: isCooperativeApplication ? cooperativeId : null,
          cooperativeName: isCooperativeApplication ? cooperativeName : null,
          principalAmount: amount,
          interestRate: 0,
          termMonths: term,
          paymentFrequency: formFrequency,
          purpose: formPurpose.trim(),
          totalInterest: 0,
          totalRepayment: amount,
          installmentAmount: 0,
          numberOfPayments: 0,
          status: history.hasDefaults ? "needs_review" : "pending_approval",
          accountStatus: "open",
          totalPaid: 0,
          remainingBalance: 0,
          defaultedPayments: history.totalDefaultedPayments,
          onTimePayments: 0,
          nextPaymentDue: "",
          hasHistoryFlag: history.hasDefaults,
          historyNotes: history.historyNotes,
          notes: "",
          createdAt: now,
          createdBy: user.uid,
          updatedAt: now,
        });
        await writeAuditLog({
          actor: { uid: user.uid, name: profile.name, role: profile.role },
          action: "loan_submitted",
          entityType: "loan",
          entityId: loanId,
          newStatus: history.hasDefaults ? "needs_review" : "pending_approval",
          notes: `${profile.name} submitted a ${money(amount)} individual loan application.`,
        });
      }
      await broadcastNotification(
        "admin",
        "loan_submitted",
        resubmittingLoan
          ? "Loan application resubmitted"
          : "New loan application",
        resubmittingLoan
          ? `${profile.name} resubmitted loan ${resubmittingLoan.id} for ${money(amount)}. Notes: ${formNotes.trim()}`
          : `${profile.name} submitted a ${money(amount)} loan application.`,
      );
      closeApplicationModal();
      setFormPurpose("");
      setFormAmount("");
      setFormTerm("12");
      setFormNotes("");
    } catch (error) {
      console.error("Failed to submit loan application:", error);
      setFormError("Unable to submit the loan application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !user || !paymentForEntry || !paymentForLoan) return;
    const paymentLoan = loans.find((loan) => loan.id === paymentForLoan);
    if (
      !canManageLoanPayment(paymentLoan, paymentForEntry, profile.uid)
    ) {
      setFormError("You can only submit payments assigned to your account.");
      return;
    }
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !payReceipt) {
      setFormError("Enter a valid amount and attach a receipt image.");
      return;
    }

    const isFullPayoff =
      Boolean(paymentLoan) &&
      amount >= ((paymentLoan?.remainingBalance ?? paymentForEntry.amountDue));

    setSubmitting(true);
    setFormError(null);
    try {
      const receiptPath = getDocumentPath(
        user.uid,
        `loan_receipt_${paymentForEntry.paymentNumber}`,
        payReceipt,
      );
      const receiptImage = await uploadFile(payReceipt, receiptPath);
      await updateDoc(doc(db, "loanPayments", paymentForEntry.id), {
        amountPaid: amount,
        paidAt: new Date().toISOString(),
        paidBy: user.uid,
        paidByName: profile.name,
        receiptImage,
        receiptNotes: payNotes.trim(),
        status: isFullPayoff || amount >= paymentForEntry.amountDue ? "paid" : "partial",
        isFullPayoff: isFullPayoff || undefined,
        disputeReason: null,
        disputedAt: null,
        disputedBy: null,
        resubmittedAt:
          paymentForEntry.status === "disputed"
            ? new Date().toISOString()
            : null,
        resubmissionNotes:
          paymentForEntry.status === "disputed" ? payNotes.trim() : null,
      });
      await writeAuditLog({
        actor: { uid: user.uid, name: profile.name, role: profile.role },
        action:
          paymentForEntry.status === "disputed"
            ? "loan_payment_resubmitted"
            : "loan_payment_submitted",
        entityType: "loan_payment",
        entityId: paymentForEntry.id,
        applicationId: paymentForLoan,
        oldStatus: paymentForEntry.status,
        newStatus: isFullPayoff || amount >= paymentForEntry.amountDue ? "paid" : "partial",
        notes: isFullPayoff
          ? `${profile.name} submitted full payoff of ${money(amount)} for loan ${paymentForLoan}.`
          : `${profile.name} submitted a ${money(amount)} payment for loan ${paymentForLoan}.`,
      });
      await broadcastNotification(
        "admin",
        "payment_received",
        isFullPayoff ? "Full loan payoff received" : "Loan payment received",
        isFullPayoff
          ? `${profile.name} submitted a full payoff of ${money(amount)} for loan ${paymentForLoan}.`
          : `${profile.name} submitted a ${money(amount)} payment for loan ${paymentForLoan}.`,
      );
      setShowPaymentModal(false);
    } catch (error) {
      console.error("Failed to submit payment:", error);
      setFormError("Unable to submit the payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEarlyRepaymentModal = (loan: Loan) => {
    if (!profile || loan.applicantType !== "cooperative") return;
    const balance = calculateOwnedBalance(loan, payments, profile.uid);
    if (balance <= 0) return;
    setEarlyRepaymentLoan(loan);
    setEarlyRepaymentAmount(balance.toFixed(2));
    setEarlyRepaymentReceipt(null);
    setEarlyRepaymentNotes("");
    setFormError(null);
  };

  const handleEarlyRepayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !user || !earlyRepaymentLoan) return;
    const amount = Number(earlyRepaymentAmount);
    const balance = calculateOwnedBalance(
      earlyRepaymentLoan,
      payments,
      profile.uid,
    );
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !earlyRepaymentReceipt ||
      Math.abs(amount - balance) > 0.01
    ) {
      setFormError(
        `Enter the full remaining balance of ${money(balance)} and attach a receipt.`,
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const receiptImage = await uploadFile(
        earlyRepaymentReceipt,
        getDocumentPath(
          user.uid,
          `early_repayment_${earlyRepaymentLoan.id}`,
          earlyRepaymentReceipt,
        ),
      );
      const memberPayments = payments.filter(
        (payment) =>
          payment.loanId === earlyRepaymentLoan.id &&
          canManageLoanPayment(earlyRepaymentLoan, payment, profile.uid),
      );
      const earlyRepayment = await addDoc(collection(db, "loanPayments"), {
        loanId: earlyRepaymentLoan.id,
        applicantId: profile.uid,
        memberId: profile.uid,
        memberName: profile.name,
        paymentNumber:
          Math.max(0, ...memberPayments.map((payment) => payment.paymentNumber)) +
          1,
        dueDate: new Date().toISOString(),
        amountDue: amount,
        amountPaid: amount,
        status: "paid",
        isEarlyRepayment: true,
        paidAt: new Date().toISOString(),
        paidBy: user.uid,
        paidByName: profile.name,
        receiptImage,
        receiptNotes: earlyRepaymentNotes.trim(),
        createdAt: new Date().toISOString(),
      });
      await writeAuditLog({
        actor: { uid: user.uid, name: profile.name, role: profile.role },
        action: "early_repayment_submitted",
        entityType: "loan_payment",
        entityId: earlyRepayment.id,
        applicationId: earlyRepaymentLoan.id,
        newStatus: "paid",
        notes: `${profile.name} submitted an early repayment of ${money(amount)} for ${earlyRepaymentLoan.id}.`,
      });
      await broadcastNotification(
        "admin",
        "payment_received",
        "Early cooperative repayment received",
        `${profile.name} submitted an early repayment of ${money(amount)} for ${earlyRepaymentLoan.id}.`,
      );
      setEarlyRepaymentLoan(null);
    } catch (earlyRepaymentError) {
      console.error("Failed to submit early repayment:", earlyRepaymentError);
      setFormError("Unable to submit the early repayment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIncomeExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !user) return;
    const amount = Number(ieAmount);
    if (!ieCategory || !ieDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Complete the category, description, and amount.");
      return;
    }
    const matchingPayment =
      incomeExpenseType === "expense" && ieCategory === "Loan Payment"
        ? payments.find((payment) => {
            const paymentLoan = loans.find(
              (loan) => loan.id === payment.loanId,
            );
            return (
              selectedLedgerLoanId !== "all" &&
              payment.loanId === selectedLedgerLoanId &&
              canManageLoanPayment(paymentLoan, payment, profile.uid) &&
              (payment.status === "paid" || payment.status === "partial") &&
              Math.abs(payment.amountPaid - amount) < 0.01
            );
          })
        : undefined;
    if (
      incomeExpenseType === "expense" &&
      ieCategory === "Loan Payment" &&
      selectedLedgerLoanId === "all"
    ) {
      setFormError("Select a specific loan before recording a loan payment.");
      return;
    }
    if (
      incomeExpenseType === "expense" &&
      ieCategory === "Loan Payment" &&
      !matchingPayment
    ) {
      setFormError(
        "Record the actual loan payment first before adding it to expenses.",
      );
      return;
    }

    if (incomeExpenseType === "income" && applyDirectlyToLoan) {
      if (!incomeTargetLoanId) {
        setFormError("Select an active loan to apply payment towards.");
        return;
      }
      const payPortion = Number(incomeApplyAmount || amount);
      if (!Number.isFinite(payPortion) || payPortion <= 0 || payPortion > amount) {
        setFormError(`Enter a valid payment portion up to ${money(amount)}.`);
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    try {
      let receiptImage: string | undefined;
      if (ieReceipt) {
        receiptImage = await uploadFile(
          ieReceipt,
          getDocumentPath(user.uid, "ledger_receipt", ieReceipt),
        );
      }

      const assignedLoanId =
        selectedLedgerLoanId === "all"
          ? applyDirectlyToLoan && incomeTargetLoanId
            ? incomeTargetLoanId
            : null
          : selectedLedgerLoanId;

      const createdIncomeDoc = await addDoc(collection(db, "loanIncomeExpenses"), {
        userId: profile.uid,
        userName: profile.name,
        type: incomeExpenseType,
        category: ieCategory,
        description: ieDescription.trim(),
        amount,
        date: new Date(ieDate).toISOString(),
        loanId: assignedLoanId,
        receiptImage: receiptImage || null,
        appliedToLoanId: applyDirectlyToLoan && incomeTargetLoanId ? incomeTargetLoanId : undefined,
        appliedAmount: applyDirectlyToLoan ? Number(incomeApplyAmount || amount) : undefined,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });

      if (incomeExpenseType === "income" && applyDirectlyToLoan && incomeTargetLoanId) {
        const payPortion = Number(incomeApplyAmount || amount);
        const targetLoan = loans.find((l) => l.id === incomeTargetLoanId);
        if (targetLoan) {
          const targetPayments = payments
            .filter(
              (p) =>
                p.loanId === targetLoan.id &&
                (p.status === "upcoming" || p.status === "overdue" || p.status === "disputed"),
            )
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          const nextPayment = targetPayments[0];
          const isFullPayoff =
            payPortion >= (targetLoan.remainingBalance || targetLoan.totalRepayment);

          let paymentDocId = nextPayment?.id;
          if (nextPayment) {
            await updateDoc(doc(db, "loanPayments", nextPayment.id), {
              amountPaid: payPortion,
              paidAt: new Date().toISOString(),
              paidBy: user.uid,
              paidByName: profile.name,
              receiptImage: receiptImage || null,
              receiptNotes: `Paid from farm harvest/sales income: ${ieDescription.trim()}`,
              status: isFullPayoff || payPortion >= nextPayment.amountDue ? "paid" : "partial",
              isFullPayoff: isFullPayoff || undefined,
              paidFromIncomeId: createdIncomeDoc.id,
              disputeReason: null,
              disputedAt: null,
              disputedBy: null,
            });
          } else {
            const created = await addDoc(collection(db, "loanPayments"), {
              loanId: targetLoan.id,
              applicantId: profile.uid,
              memberId: profile.uid,
              memberName: profile.name,
              paymentNumber:
                Math.max(
                  0,
                  ...payments
                    .filter((p) => p.loanId === targetLoan.id)
                    .map((p) => p.paymentNumber),
                ) + 1,
              dueDate: new Date().toISOString(),
              amountDue: payPortion,
              amountPaid: payPortion,
              status: "paid",
              isEarlyRepayment: true,
              isFullPayoff: isFullPayoff || undefined,
              paidAt: new Date().toISOString(),
              paidBy: user.uid,
              paidByName: profile.name,
              receiptImage: receiptImage || null,
              receiptNotes: `Paid from farm harvest/sales income: ${ieDescription.trim()}`,
              paidFromIncomeId: createdIncomeDoc.id,
              createdAt: new Date().toISOString(),
            });
            paymentDocId = created.id;
          }

          // Automatically record matching ledger expense
          await addDoc(collection(db, "loanIncomeExpenses"), {
            userId: profile.uid,
            userName: profile.name,
            type: "expense",
            category: "Loan Payment",
            description: `Auto-payment for loan ${targetLoan.id} deducted from farm income (${ieDescription.trim()})`,
            amount: payPortion,
            date: new Date(ieDate).toISOString(),
            loanId: targetLoan.id,
            receiptImage: receiptImage || null,
            appliedFromIncomeId: createdIncomeDoc.id,
            createdAt: new Date().toISOString(),
            createdBy: user.uid,
          });

          await writeAuditLog({
            actor: { uid: user.uid, name: profile.name, role: profile.role },
            action: "income_applied_to_loan",
            entityType: "loan_payment",
            entityId: paymentDocId || targetLoan.id,
            applicationId: targetLoan.id,
            newStatus: "paid",
            notes: `${profile.name} applied ${money(payPortion)} from farm income "${ieDescription.trim()}" to loan ${targetLoan.id}.`,
          });

          await broadcastNotification(
            "admin",
            "payment_received",
            "Loan payment from farm income",
            `${profile.name} applied ${money(payPortion)} from farm income towards loan ${targetLoan.id}.`,
          );
        }
      }

      setShowIncomeExpenseModal(false);
      setIeCategory("");
      setIeDescription("");
      setIeAmount("");
      setIeReceipt(null);
      setApplyDirectlyToLoan(false);
      setIncomeTargetLoanId("");
      setIncomeApplyAmount("");
    } catch (error) {
      console.error("Failed to save ledger entry:", error);
      setFormError("Unable to save the ledger entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const openApplyIncomeModal = (entry: LoanIncomeExpense) => {
    setSelectedIncomeForPayment(entry);
    const defaultTargetId =
      entry.loanId ||
      (selectedLedgerLoanId !== "all" ? selectedLedgerLoanId : "") ||
      allPersonalLoans.find((l) => l.status === "active")?.id ||
      loans.find((l) => l.status === "active")?.id ||
      "";
    setApplyIncomeTargetLoanId(defaultTargetId);
    setApplyIncomeAmount(String(entry.amount));
    setApplyIncomeNotes("");
    setFormError(null);
    setShowApplyIncomeModal(true);
  };

  const handleApplyIncomePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !user || !selectedIncomeForPayment) return;
    const targetLoan = loans.find((l) => l.id === applyIncomeTargetLoanId);
    if (!targetLoan) {
      setFormError("Please select an active loan to apply payment to.");
      return;
    }
    const amount = Number(applyIncomeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a valid payment amount.");
      return;
    }
    if (amount > selectedIncomeForPayment.amount) {
      setFormError(
        `Amount cannot exceed available income of ${money(selectedIncomeForPayment.amount)}.`,
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const targetPayments = payments
        .filter(
          (p) =>
            p.loanId === targetLoan.id &&
            (p.status === "upcoming" || p.status === "overdue" || p.status === "disputed"),
        )
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      const nextPayment = targetPayments[0];
      const isFullPayoff =
        amount >= (targetLoan.remainingBalance || targetLoan.totalRepayment);

      let paymentDocId = nextPayment?.id;
      if (nextPayment) {
        await updateDoc(doc(db, "loanPayments", nextPayment.id), {
          amountPaid: amount,
          paidAt: new Date().toISOString(),
          paidBy: user.uid,
          paidByName: profile.name,
          receiptImage: selectedIncomeForPayment.receiptImage || null,
          receiptNotes: `Paid from farm harvest/sales income: ${selectedIncomeForPayment.description}${
            applyIncomeNotes.trim() ? ` (${applyIncomeNotes.trim()})` : ""
          }`,
          status: isFullPayoff || amount >= nextPayment.amountDue ? "paid" : "partial",
          isFullPayoff: isFullPayoff || undefined,
          paidFromIncomeId: selectedIncomeForPayment.id,
          disputeReason: null,
          disputedAt: null,
          disputedBy: null,
        });
      } else {
        const created = await addDoc(collection(db, "loanPayments"), {
          loanId: targetLoan.id,
          applicantId: profile.uid,
          memberId: profile.uid,
          memberName: profile.name,
          paymentNumber:
            Math.max(
              0,
              ...payments
                .filter((p) => p.loanId === targetLoan.id)
                .map((p) => p.paymentNumber),
            ) + 1,
          dueDate: new Date().toISOString(),
          amountDue: amount,
          amountPaid: amount,
          status: "paid",
          isEarlyRepayment: true,
          isFullPayoff: isFullPayoff || undefined,
          paidAt: new Date().toISOString(),
          paidBy: user.uid,
          paidByName: profile.name,
          receiptImage: selectedIncomeForPayment.receiptImage || null,
          receiptNotes: `Paid from farm harvest/sales income: ${selectedIncomeForPayment.description}${
            applyIncomeNotes.trim() ? ` (${applyIncomeNotes.trim()})` : ""
          }`,
          paidFromIncomeId: selectedIncomeForPayment.id,
          createdAt: new Date().toISOString(),
        });
        paymentDocId = created.id;
      }

      // Record matching expense in loanIncomeExpenses
      await addDoc(collection(db, "loanIncomeExpenses"), {
        userId: profile.uid,
        userName: profile.name,
        type: "expense",
        category: "Loan Payment",
        description: `Auto-payment for loan ${targetLoan.id} deducted from farm income (${selectedIncomeForPayment.description})`,
        amount,
        date: new Date().toISOString(),
        loanId: targetLoan.id,
        receiptImage: selectedIncomeForPayment.receiptImage || null,
        appliedFromIncomeId: selectedIncomeForPayment.id,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });

      // Update source income document
      await updateDoc(doc(db, "loanIncomeExpenses", selectedIncomeForPayment.id), {
        appliedToLoanId: targetLoan.id,
        appliedAmount: (selectedIncomeForPayment.appliedAmount || 0) + amount,
      });

      await writeAuditLog({
        actor: { uid: user.uid, name: profile.name, role: profile.role },
        action: "income_applied_to_loan",
        entityType: "loan_payment",
        entityId: paymentDocId || targetLoan.id,
        applicationId: targetLoan.id,
        newStatus: "paid",
        notes: `${profile.name} applied ${money(amount)} from farm income "${selectedIncomeForPayment.description}" to loan ${targetLoan.id}.`,
      });

      await broadcastNotification(
        "admin",
        "payment_received",
        "Loan payment from farm income",
        `${profile.name} applied ${money(amount)} from farm income towards loan ${targetLoan.id}.`,
      );

      setShowApplyIncomeModal(false);
      setSelectedIncomeForPayment(null);
      setApplyIncomeAmount("");
      setApplyIncomeNotes("");
    } catch (error) {
      console.error("Failed to apply income as payment:", error);
      setFormError("Unable to apply income as loan payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const paymentsForLoan = (loanId: string) =>
    payments
      .filter((payment) => payment.loanId === loanId)
      .sort((a, b) => a.paymentNumber - b.paymentNumber);

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 grid place-items-center pt-14 md:pt-0">
          <p className="text-sm text-slate-500">Loading loan records...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-14 md:p-6 md:pt-0 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Loan Services
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {isCooperativeApplication ? "Cooperative Loans" : "My Loans"}
              </h1>
              <p className="text-sm text-slate-500">
                {isCooperativeApplication
                  ? `Apply and track loans for ${cooperativeName}.`
                  : "Apply, track payments, and record your farm finances."}
              </p>
            </div>
            {activeTab === "loans" && (
              <button
                onClick={() => {
                  setResubmittingLoan(null);
                  setFormPurpose("");
                  setFormAmount("");
                  setFormTerm("12");
                  setFormFrequency("monthly");
                  setFormNotes("");
                  setFormError(null);
                  setShowApplyModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                <Plus size={16} />{" "}
                {isCooperativeApplication
                  ? "Apply for Cooperative Loan"
                  : "Apply for Loan"}
              </button>
            )}
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard
              label="Active Loans"
              value={String(scopedActiveLoansCount)}
              icon={<Landmark size={18} />}
              subtitle={
                selectedLedgerLoanId !== "all"
                  ? `Loan: ${selectedLedgerLoanId}`
                  : `${relevantLoans.length} total applications`
              }
            />
            <SummaryCard
              label="Outstanding Balance"
              value={money(scopedTotalOutstanding)}
              icon={<DollarSign size={18} />}
              subtitle={
                selectedLedgerLoanId !== "all"
                  ? `of ${money(scopedTotalObligation)} obligation`
                  : "Across active loans"
              }
            />
            <SummaryCard
              label="Next Due"
              value={scopedNextDuePayment ? formatDate(scopedNextDuePayment.dueDate) : "—"}
              icon={<Calendar size={18} />}
              subtitle={
                scopedNextDuePayment
                  ? `${money(scopedNextDuePayment.amountDue)} due`
                  : "All dues up to date"
              }
            />
            <SummaryCard
              label="Net Farm Profit"
              value={money(displayedNetProfit)}
              positive={displayedNetProfit >= 0}
              icon={
                displayedNetProfit >= 0 ? (
                  <TrendingUp size={18} />
                ) : (
                  <TrendingDown size={18} />
                )
              }
              subtitle={`Income ${money(visibleLedgerIncome)} · Exp ${money(visibleLedgerExpenses)}`}
            />
            <SummaryCard
              label="Loan Profitability (ROI)"
              value={profitabilityMetrics.formattedRatio}
              positive={profitabilityMetrics.positive}
              icon={<Percent size={18} />}
              badge={{
                text: profitabilityMetrics.label,
                color: profitabilityMetrics.color,
                bgColor: profitabilityMetrics.bgColor,
              }}
              subtitle={
                scopedTotalObligation > 0
                  ? `Profit / ${money(scopedTotalObligation)} loan`
                  : "No loan obligation"
              }
            />
          </div>

          {selectedLedgerLoanId !== "all" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 shadow-sm">
              <span className="font-medium">
                🎯 Viewing dynamic overview for <b>{selectedLedgerLoanId}</b>. All top cards reflect this loan's balance, due date, profit, and ROI.
              </span>
              <button
                onClick={() => setSelectedLedgerLoanId("all")}
                className="rounded-lg bg-emerald-700 px-3 py-1 font-bold text-white hover:bg-emerald-800"
              >
                Reset to All Loans
              </button>
            </div>
          )}

          <div className="flex gap-2 border-b border-slate-200">
            {[
              ["loans", "My Loans"],
              ["income_expenses", "Income & Expenses"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as TabId)}
                className={`border-b-2 px-4 py-3 text-sm font-bold ${
                  activeTab === id
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "loans" ? (
            <div className="space-y-3">
              {heroLoan && (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        Active loan health
                      </p>
                      <h2 className="mt-1 font-bold text-emerald-950">
                        {heroLoan.purpose}
                      </h2>
                      <p className="mt-1 text-xs text-emerald-800">
                        {heroLoan.id} · {money(heroLoan.remainingBalance)} remaining
                      </p>
                    </div>
                    {heroNextPayment && (
                      <button
                        onClick={() => openPaymentModal(heroLoan, heroNextPayment)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        <Calendar size={14} />
                        Pay next installment
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Metric
                      label="Next payment"
                      value={
                        heroNextPayment
                          ? `${money(heroNextPayment.amountDue)} · ${formatDate(heroNextPayment.dueDate)}`
                          : "No upcoming payment"
                      }
                    />
                    <Metric
                      label="Installments paid"
                      value={`${heroPaidInstallments} of ${heroPayments.length}`}
                    />
                    <Metric label="Progress" value={`${heroProgress}% paid`} />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${heroProgress}%` }}
                    />
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Lifetime financial snapshot
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Your individual borrowing history and repayment progress.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
                    <Metric label="Borrowed" value={money(lifetimeBorrowed)} />
                    <Metric label="Repaid" value={money(lifetimeRepaid)} />
                    <Metric
                      label="Outstanding"
                      value={money(
                        allPersonalLoans.reduce(
                          (sum, loan) => sum + (loan.remainingBalance || 0),
                          0,
                        ),
                      )}
                    />
                    <Metric label="Completed loans" value={String(completedPersonalLoans)} />
                  </div>
                </div>
              </section>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
                <label className="relative block">
                  <span className="sr-only">Search loans</span>
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={loanSearch}
                    onChange={(event) => setLoanSearch(event.target.value)}
                    className={`${inputClassName} pl-9`}
                    placeholder="Search by loan ID or purpose"
                  />
                </label>
                <div>
                  <p className="mb-1 text-xs font-bold text-slate-600">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["all", "All"],
                        ["active", "Active"],
                        ["pending", "Pending"],
                        ["completed", "Completed"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setLoanStatusFilter(value)}
                        className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold ${
                          loanStatusFilter === value
                            ? "border-emerald-800 bg-emerald-800 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredPersonalLoans.length === 0 && (
                <EmptyState
                  title={
                    allPersonalLoans.length === 0
                      ? "No individual loan applications yet"
                      : "No individual loans match your filters"
                  }
                  text={
                    allPersonalLoans.length === 0
                      ? "Your personal My Loans area only contains individual loans. Cooperative loans are shown separately below."
                      : "Try a different search term or status filter."
                  }
                />
              )}
              {filteredPersonalLoans.map((loan) => {
                const expanded = expandedLoan === loan.id;
                const loanPayments = paymentsForLoan(loan.id);
                const status = LOAN_STATUS_CONFIG[loan.status];
                return (
                  <section key={loan.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <button
                      onClick={() => setExpandedLoan(expanded ? null : loan.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-xs font-bold text-emerald-800">{loan.id}</p>
                        <h2 className="font-bold text-slate-900">{loan.purpose}</h2>
                        <p className="text-xs text-slate-500">
                          {money(loan.principalAmount)} · {loan.termMonths} months · {FREQUENCY_LABELS[loan.paymentFrequency]}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.bgColor} ${status.color}`}>
                          {status.label}
                        </span>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="space-y-4 border-t border-slate-100 p-4">
                        {loan.hasHistoryFlag && (
                          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{loan.historyNotes}</span>
                          </div>
                        )}
                        {loan.status === "rejected" && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-bold">Loan application rejected</p>
                                <p className="mt-1">
                                  {loan.rejectedReason ||
                                    "The administrator requested changes before this loan can be reviewed again."}
                                </p>
                              </div>
                              {loan.applicantType === "cooperative" ? (
                                <p className="max-w-44 text-right text-[10px] font-semibold text-red-700">
                                  Resubmit this cooperative loan from the ARBO
                                  Dashboard.
                                </p>
                              ) : (
                                <button
                                  onClick={() => openResubmissionModal(loan)}
                                  className="rounded-lg bg-red-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-red-800"
                                >
                                  Resubmit with Notes
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                          <Metric label="Interest" value={`${loan.interestRate}%`} />
                          <Metric label="Repayment" value={money(loan.totalRepayment)} />
                          <Metric label="Paid" value={money(loan.totalPaid)} />
                          <Metric label="Balance" value={money(loan.remainingBalance)} />
                        </div>
                        {loan.applicantType === "cooperative" &&
                          loan.memberAllocations &&
                          loan.memberAllocations.length > 0 && (
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
                              <p className="font-bold text-indigo-800">
                                Member allocation
                              </p>
                              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                {loan.memberAllocations.map((allocation) => (
                                  <div
                                    key={allocation.memberId}
                                    className="flex items-center justify-between gap-3 text-slate-600"
                                  >
                                    <span>{allocation.memberName}</span>
                                    <span
                                      className={`font-bold ${
                                        allocation.amount === 0
                                          ? "text-slate-400"
                                          : "text-slate-800"
                                      }`}
                                    >
                                      {money(allocation.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        {loanPayments.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                                <tr>
                                  <th className="p-2">#</th>
                                  {loan.applicantType === "cooperative" && (
                                    <th className="p-2">Member</th>
                                  )}
                                  <th className="p-2">Due</th>
                                  <th className="p-2">Amount</th>
                                  <th className="p-2">Status</th>
                                  <th className="p-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {loanPayments.map((payment) => {
                                  const paymentStatus = PAYMENT_STATUS_CONFIG[payment.status];
                                  const canManagePayment =
                                    profile &&
                                    canManageLoanPayment(
                                      loan,
                                      payment,
                                      profile.uid,
                                    );
                                  const pendingVerification =
                                    isPaymentPendingVerification(payment);
                                  return (
                                    <tr key={payment.id}>
                                      <td className="p-2 font-bold">{payment.paymentNumber}</td>
                                      {loan.applicantType === "cooperative" && (
                                        <td className="p-2">
                                          {payment.memberName || "Cooperative member"}
                                        </td>
                                      )}
                                      <td className="p-2">{formatDate(payment.dueDate)}</td>
                                      <td className="p-2 font-bold">{money(payment.amountDue)}</td>
                                      <td className="p-2">
                                        <span
                                          className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                                            pendingVerification
                                              ? "border-amber-200 bg-amber-50 text-amber-700"
                                              : `${paymentStatus.bgColor} ${paymentStatus.color}`
                                          }`}
                                        >
                                          {pendingVerification
                                            ? "Pending verification"
                                            : paymentStatus.label}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right">
                                        {loan.status === "active" &&
                                          canManagePayment &&
                                          !pendingVerification &&
                                          (payment.status === "upcoming" ||
                                            payment.status === "disputed") && (
                                          <button
                                            onClick={() => openPaymentModal(loan, payment)}
                                            className="rounded-lg bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white"
                                          >
                                            {payment.status === "disputed"
                                              ? "Resubmit Payment"
                                              : "Make Payment"}
                                          </button>
                                        )}
                                        {canManagePayment &&
                                        loan.status === "active" &&
                                        pendingVerification && (
                                          <span className="text-[10px] font-semibold text-amber-700">
                                            Awaiting admin verification
                                          </span>
                                        )}
                                        {loan.applicantType === "cooperative" &&
                                          !canManagePayment && (
                                              <span className="text-[10px] text-slate-400">
                                                View only
                                              </span>
                                          )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Payment schedule will appear after approval.</p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
              {filteredCooperativeLoans.length > 0 && (
                <section className="mt-6 space-y-3">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <h2 className="font-bold text-indigo-900">
                      Cooperative Loan History
                    </h2>
                    <p className="mt-1 text-xs text-indigo-700">
                      This is separate from your personal loans. You can view
                      every member's payment history, but you can only submit
                      payments assigned to your own member account.
                    </p>
                  </div>
                  {filteredCooperativeLoans.map((loan) => {
                    const loanPayments = paymentsForLoan(loan.id);
                    const scheduledPayments = loanPayments.filter(
                      (payment) => !payment.isEarlyRepayment,
                    );
                    const expanded = expandedLoan === loan.id;
                    const ownedBalance = profile
                      ? calculateOwnedBalance(loan, payments, profile.uid)
                      : 0;
                    const pendingEarlyRepayment =
                      profile &&
                      loanPayments.some(
                        (payment) =>
                          payment.isEarlyRepayment &&
                          payment.memberId === profile.uid &&
                          !payment.verifiedAt &&
                          (payment.status === "paid" ||
                            payment.status === "partial"),
                      );
                    return (
                      <section
                        key={loan.id}
                        className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm"
                      >
                        <button
                          onClick={() =>
                            setExpandedLoan(expanded ? null : loan.id)
                          }
                          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-indigo-50/40"
                        >
                          <div>
                            <p className="text-xs font-bold text-indigo-800">
                              {loan.id}
                            </p>
                            <h2 className="font-bold text-slate-900">
                              {loan.purpose}
                            </h2>
                            <p className="text-xs text-slate-500">
                              {loan.cooperativeName || "Cooperative loan"} ·{" "}
                              {money(loan.principalAmount)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                              Shared history
                            </span>
                            {expanded ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </div>
                        </button>
                        {expanded && (
                          <div className="space-y-4 border-t border-indigo-100 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                              <span className="text-slate-600">
                                Your remaining cooperative share:{" "}
                                <b>{money(ownedBalance)}</b>
                              </span>
                              {pendingEarlyRepayment ? (
                                <span className="font-semibold text-amber-700">
                                  Early repayment is awaiting admin
                                  verification.
                                </span>
                              ) : (
                                loan.status === "active" &&
                                ownedBalance > 0 && (
                                  <button
                                    onClick={() =>
                                      openEarlyRepaymentModal(loan)
                                    }
                                    className="rounded-lg bg-indigo-700 px-3 py-2 text-[10px] font-bold text-white"
                                  >
                                    Repay My Share Early
                                  </button>
                                )
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                                  <tr>
                                    <th className="p-2">Member</th>
                                    <th className="p-2">#</th>
                                    <th className="p-2">Due</th>
                                    <th className="p-2">Amount</th>
                                    <th className="p-2">Status</th>
                                    <th className="p-2"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {scheduledPayments.map((payment) => {
                                    const canManagePayment =
                                      profile &&
                                      canManageLoanPayment(
                                        loan,
                                        payment,
                                        profile.uid,
                                      );
                                    const paymentStatus =
                                      PAYMENT_STATUS_CONFIG[payment.status];
                                    const pendingVerification =
                                      isPaymentPendingVerification(payment);
                                    return (
                                      <tr key={payment.id}>
                                        <td className="p-2">
                                          {payment.memberName ||
                                            payment.paidByName ||
                                            "Cooperative member"}
                                        </td>
                                        <td className="p-2 font-bold">
                                          {payment.paymentNumber}
                                        </td>
                                        <td className="p-2">
                                          {formatDate(payment.dueDate)}
                                        </td>
                                        <td className="p-2 font-bold">
                                          {money(payment.amountDue)}
                                        </td>
                                        <td className="p-2">
                                          <span
                                            className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                                              pendingVerification
                                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                                : `${paymentStatus.bgColor} ${paymentStatus.color}`
                                            }`}
                                          >
                                            {pendingVerification
                                                ? "Pending verification"
                                              : paymentStatus.label}
                                          </span>
                                        </td>
                                        <td className="p-2 text-right">
                                          {canManagePayment &&
                                            loan.status === "active" &&
                                            !pendingVerification &&
                                            (payment.status === "upcoming" ||
                                              payment.status === "disputed") && (
                                              <button
                                                onClick={() =>
                                                  openPaymentModal(loan, payment)
                                                }
                                                className="rounded-lg bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white"
                                              >
                                                {payment.status === "disputed"
                                                  ? "Resubmit Payment"
                                                  : "Make Payment"}
                                              </button>
                                            )}
                                          {canManagePayment &&
                                            loan.status === "active" &&
                                            pendingVerification && (
                                            <span className="text-[10px] font-semibold text-amber-700">
                                              Awaiting admin verification
                                            </span>
                                            )}
                                          {!canManagePayment && (
                                            <span className="text-[10px] text-slate-400">
                                              View only
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </section>
              )}
            </div>
          ) : (
            <LedgerSection
              entries={visibleLedgerEntries}
              loans={loans}
              selectedLoanId={selectedLedgerLoanId}
              onLoanChange={setSelectedLedgerLoanId}
              totalIncome={visibleLedgerIncome}
              totalExpenses={visibleLedgerExpenses}
              categoryFilter={ledgerCategoryFilter}
              categoryOptions={ledgerCategoryOptions}
              onCategoryChange={setLedgerCategoryFilter}
              onAdd={(type) => {
                setIncomeExpenseType(type);
                setIeCategory("");
                setApplyDirectlyToLoan(false);
                setIncomeTargetLoanId("");
                setIncomeApplyAmount("");
                setFormError(null);
                setShowIncomeExpenseModal(true);
              }}
              onApplyIncomeToLoan={openApplyIncomeModal}
            />
          )}
        </div>
      </main>

      {showApplyModal && (
        <Modal
          title={
            isCooperativeApplication
              ? "Apply for a Cooperative Loan"
              : "Apply for a Loan"
          }
          onClose={closeApplicationModal}
        >
          <form onSubmit={handleApply} className="space-y-4">
            <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              {resubmittingLoan
                ? "Update the application and explain how you addressed the administrator's rejection."
                : isCooperativeApplication
                ? `This application will be submitted for ${cooperativeName} and monitored by the ARBO Head and admin.`
                : "This application is for your individual loan account."}
            </p>
            {resubmittingLoan?.rejectedReason && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <p className="font-bold">Administrator's rejection reason</p>
                <p className="mt-1">{resubmittingLoan.rejectedReason}</p>
              </div>
            )}
            <Field label="Purpose">
              <textarea value={formPurpose} onChange={(event) => setFormPurpose(event.target.value)} rows={3} className={inputClassName} placeholder="What will the loan support?" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input type="number" min="1" value={formAmount} onChange={(event) => setFormAmount(event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Term (months)">
                <input type="number" min="1" value={formTerm} onChange={(event) => setFormTerm(event.target.value)} className={inputClassName} />
              </Field>
            </div>
            <Field label="Payment frequency">
              <select value={formFrequency} onChange={(event) => setFormFrequency(event.target.value as PaymentFrequency)} className={inputClassName}>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            {resubmittingLoan && (
              <Field label="Resubmission notes (required)">
                <textarea
                  value={formNotes}
                  onChange={(event) => setFormNotes(event.target.value)}
                  rows={3}
                  className={inputClassName}
                  placeholder="Explain what you changed or corrected."
                />
              </Field>
            )}
            {formError && <ErrorText text={formError} />}
            <SubmitButton
              loading={submitting}
              label={
                resubmittingLoan
                  ? "Resubmit Loan Application"
                  : "Submit Application"
              }
            />
          </form>
        </Modal>
      )}

      {showPaymentModal && paymentForEntry && (() => {
        const currentLoan = loans.find((l) => l.id === paymentForLoan);
        const remainingBal = currentLoan?.remainingBalance || paymentForEntry.amountDue;
        const numPayAmount = Number(payAmount);

        return (
          <Modal title={`Payment ${paymentForEntry.paymentNumber} · ${paymentForLoan || ""}`} onClose={() => setShowPaymentModal(false)}>
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                <span className="text-slate-600">
                  Scheduled Due: <b>{money(paymentForEntry.amountDue)}</b> on {formatDate(paymentForEntry.dueDate)}
                </span>
                <span className="text-slate-600">
                  Total Remaining: <b className="text-emerald-800">{money(remainingBal)}</b>
                </span>
              </div>

              {paymentForEntry.status === "disputed" && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                  <p className="font-bold">Admin requested a correction</p>
                  <p className="mt-1">
                    {paymentForEntry.disputeReason ||
                      "Please upload a corrected receipt and explain the correction."}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-600">Quick Payment Options</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(paymentForEntry.amountDue))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      numPayAmount === paymentForEntry.amountDue
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Scheduled: {money(paymentForEntry.amountDue)}
                  </button>
                  {remainingBal > paymentForEntry.amountDue && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(remainingBal))}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        numPayAmount === remainingBal
                          ? "border-emerald-700 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      🚀 Pay Full Balance: {money(remainingBal)}
                    </button>
                  )}
                </div>
              </div>

              <Field label="Amount paid (Flexible: lower, higher, or full balance)">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={(event) => setPayAmount(event.target.value)}
                    className={`${inputClassName} pl-7`}
                    placeholder="0.00"
                  />
                </div>
              </Field>

              {numPayAmount > 0 && (
                <div className="text-xs">
                  {numPayAmount >= remainingBal ? (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>
                        <b>Full Payoff</b>: Paying {money(numPayAmount)} will completely settle all remaining balance on this loan upon admin verification.
                      </span>
                    </div>
                  ) : numPayAmount > paymentForEntry.amountDue ? (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-blue-800">
                      <TrendingUp size={16} className="mt-0.5 shrink-0 text-blue-600" />
                      <span>
                        <b>Advance / Higher Payment</b>: Paying {money(numPayAmount - paymentForEntry.amountDue)} extra. The excess directly reduces your remaining loan principal.
                      </span>
                    </div>
                  ) : numPayAmount < paymentForEntry.amountDue ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                      <span>
                        <b>Partial Payment</b>: Paying {money(numPayAmount)} of {money(paymentForEntry.amountDue)}. The remaining installment balance will be due before next cycle.
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Paying the standard scheduled monthly installment.
                    </p>
                  )}
                </div>
              )}
            <Field label="Receipt image (required)">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                <Upload size={16} /> {payReceipt?.name || "Choose receipt"}
                <input type="file" accept="image/*" onChange={(event) => setPayReceipt(event.target.files?.[0] || null)} className="hidden" />
              </label>
            </Field>
            <Field label="Notes">
              <textarea value={payNotes} onChange={(event) => setPayNotes(event.target.value)} rows={2} className={inputClassName} placeholder={paymentForEntry.status === "disputed" ? "Explain what you corrected..." : "Optional payment notes"} />
            </Field>
            {formError && <ErrorText text={formError} />}
            <SubmitButton
              loading={submitting}
              label={
                paymentForEntry.status === "disputed"
                  ? "Resubmit Corrected Payment"
                  : "Submit Payment"
              }
            />
          </form>
        </Modal>
        );
      })()}

      {earlyRepaymentLoan && (
        <Modal
          title="Repay My Cooperative Share Early"
          onClose={() => setEarlyRepaymentLoan(null)}
        >
          <form onSubmit={handleEarlyRepayment} className="space-y-4">
            <p className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
              This repays only your allocated share of{" "}
              <b>{earlyRepaymentLoan.id}</b>. Other cooperative members keep
              their own payment schedules.
            </p>
            <Field label="Full remaining balance">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={earlyRepaymentAmount}
                onChange={(event) =>
                  setEarlyRepaymentAmount(event.target.value)
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Receipt image (required)">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                <Upload size={16} />
                {earlyRepaymentReceipt?.name || "Choose receipt"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setEarlyRepaymentReceipt(
                      event.target.files?.[0] || null,
                    )
                  }
                  className="hidden"
                />
              </label>
            </Field>
            <Field label="Notes">
              <textarea
                value={earlyRepaymentNotes}
                onChange={(event) => setEarlyRepaymentNotes(event.target.value)}
                rows={2}
                className={inputClassName}
                placeholder="Optional early repayment notes"
              />
            </Field>
            {formError && <ErrorText text={formError} />}
            <SubmitButton
              loading={submitting}
              label="Submit Early Repayment"
            />
          </form>
        </Modal>
      )}

      {showIncomeExpenseModal && (
        <Modal title={`Add ${incomeExpenseType === "income" ? "Income" : "Expense"}`} onClose={() => setShowIncomeExpenseModal(false)}>
          <form onSubmit={handleIncomeExpense} className="space-y-4">
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              This entry will be saved under{" "}
              <b>
                {selectedLedgerLoanId === "all"
                  ? "All loans and general entries"
                  : loans.find((loan) => loan.id === selectedLedgerLoanId)?.id ||
                    "the selected loan"}
              </b>
              .
            </p>
            <Field label="Category">
              <select value={ieCategory} onChange={(event) => setIeCategory(event.target.value)} className={inputClassName}>
                <option value="">Select category</option>
                {(incomeExpenseType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <input value={ieDescription} onChange={(event) => setIeDescription(event.target.value)} className={inputClassName} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"><input type="number" min="0.01" step="0.01" value={ieAmount} onChange={(event) => setIeAmount(event.target.value)} className={inputClassName} /></Field>
              <Field label="Date"><input type="date" value={ieDate} onChange={(event) => setIeDate(event.target.value)} className={inputClassName} /></Field>
            </div>

            {incomeExpenseType === "income" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-900">
                  <input
                    type="checkbox"
                    checked={applyDirectlyToLoan}
                    onChange={(e) => {
                      setApplyDirectlyToLoan(e.target.checked);
                      if (e.target.checked && !incomeTargetLoanId) {
                        const defaultId =
                          selectedLedgerLoanId !== "all"
                            ? selectedLedgerLoanId
                            : loans.find((l) => l.status === "active")?.id || "";
                        setIncomeTargetLoanId(defaultId);
                        setIncomeApplyAmount(ieAmount);
                      }
                    }}
                    className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Apply this income directly towards loan repayment</span>
                </label>

                {applyDirectlyToLoan && (
                  <div className="space-y-3 border-t border-emerald-200/60 pt-3">
                    <Field label="Select Active Loan to Pay">
                      <select
                        value={incomeTargetLoanId}
                        onChange={(e) => setIncomeTargetLoanId(e.target.value)}
                        className={inputClassName}
                      >
                        <option value="">Select an active loan</option>
                        {loans
                          .filter((l) => l.status === "active")
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.id} · {l.purpose} (Balance: {money(l.remainingBalance || 0)})
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Amount to apply towards loan payment">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={ieAmount || undefined}
                        value={incomeApplyAmount}
                        onChange={(e) => setIncomeApplyAmount(e.target.value)}
                        placeholder={`Up to ${ieAmount || "0.00"}`}
                        className={inputClassName}
                      />
                    </Field>
                    <p className="text-[11px] text-emerald-800">
                      💡 Applying income to a loan automatically creates the loan payment and a corresponding 'Loan Payment' expense in your ledger to keep net farm profit accurate.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Field label="Receipt (optional)">
              <input type="file" accept="image/*" onChange={(event) => setIeReceipt(event.target.files?.[0] || null)} className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700`} />
            </Field>
            {formError && <ErrorText text={formError} />}
            <SubmitButton loading={submitting} label="Save Entry" />
          </form>
        </Modal>
      )}

      {showApplyIncomeModal && selectedIncomeForPayment && (() => {
        const targetLoan = loans.find((l) => l.id === applyIncomeTargetLoanId);
        const targetUpcoming = payments
          .filter(
            (p) =>
              p.loanId === applyIncomeTargetLoanId &&
              (p.status === "upcoming" || p.status === "overdue" || p.status === "disputed"),
          )
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
        const numApply = Number(applyIncomeAmount);

        return (
          <Modal
            title="Apply Farm Income as Loan Payment"
            onClose={() => {
              setShowApplyIncomeModal(false);
              setSelectedIncomeForPayment(null);
            }}
          >
            <form onSubmit={handleApplyIncomePayment} className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 space-y-1 text-xs text-emerald-900">
                <p className="font-bold">Source Farm Income Entry</p>
                <div className="flex justify-between">
                  <span>{selectedIncomeForPayment.description} ({selectedIncomeForPayment.category})</span>
                  <b className="text-emerald-800">{money(selectedIncomeForPayment.amount)}</b>
                </div>
                <p className="text-[11px] text-emerald-700">Date recorded: {formatDate(selectedIncomeForPayment.date)}</p>
              </div>

              <Field label="Select Loan to Pay">
                <select
                  value={applyIncomeTargetLoanId}
                  onChange={(e) => setApplyIncomeTargetLoanId(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select an active loan</option>
                  {loans
                    .filter((l) => l.status === "active")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.id} · {l.purpose} (Balance: {money(l.remainingBalance || 0)})
                      </option>
                    ))}
                </select>
              </Field>

              {targetLoan && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <span className="text-slate-600">
                      Remaining Debt: <b>{money(targetLoan.remainingBalance || 0)}</b>
                    </span>
                    {targetUpcoming && (
                      <span className="text-slate-600">
                        Next Due: <b>{money(targetUpcoming.amountDue)}</b> ({formatDate(targetUpcoming.dueDate)})
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-bold text-slate-600">Quick Fill</p>
                    <div className="flex flex-wrap gap-2">
                      {targetUpcoming && (
                        <button
                          type="button"
                          onClick={() => setApplyIncomeAmount(String(Math.min(selectedIncomeForPayment.amount, targetUpcoming.amountDue)))}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Next Due: {money(targetUpcoming.amountDue)}
                        </button>
                      )}
                      {targetLoan.remainingBalance <= selectedIncomeForPayment.amount && (
                        <button
                          type="button"
                          onClick={() => setApplyIncomeAmount(String(targetLoan.remainingBalance))}
                          className="rounded-lg border border-emerald-700 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"
                        >
                          Full Payoff: {money(targetLoan.remainingBalance)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setApplyIncomeAmount(String(selectedIncomeForPayment.amount))}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        All Income: {money(selectedIncomeForPayment.amount)}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Amount to apply from this income">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedIncomeForPayment.amount}
                  value={applyIncomeAmount}
                  onChange={(e) => setApplyIncomeAmount(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              {numApply > 0 && targetLoan && (
                <div className="text-xs">
                  {numApply >= targetLoan.remainingBalance ? (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span><b>Full Payoff</b>: This covers the remaining debt of {money(targetLoan.remainingBalance)}.</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Applying {money(numApply)} towards loan {targetLoan.id}. A matching 'Loan Payment' expense will be added to your ledger.
                    </p>
                  )}
                </div>
              )}

              <Field label="Notes (optional)">
                <textarea
                  value={applyIncomeNotes}
                  onChange={(e) => setApplyIncomeNotes(e.target.value)}
                  rows={2}
                  className={inputClassName}
                  placeholder="e.g. Paid directly from corn harvest revenue"
                />
              </Field>

              {formError && <ErrorText text={formError} />}
              <SubmitButton loading={submitting} label="Apply Payment to Loan" />
            </form>
          </Modal>
        );
      })()}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  positive?: boolean;
  subtitle?: React.ReactNode;
  badge?: {
    text: string;
    color: string;
    bgColor: string;
  };
}> = ({ label, value, icon, positive = true, subtitle, badge }) => (
  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div>
      <div
        className={`mb-2 flex items-center justify-between ${
          positive ? "text-emerald-700" : "text-red-600"
        }`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-bold uppercase text-slate-400">
            {label}
          </span>
        </div>
        {badge && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${badge.bgColor}`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p
        className={`text-lg font-extrabold ${
          positive ? "text-slate-900" : "text-red-700"
        }`}
      >
        {value}
      </p>
    </div>
    {subtitle && (
      <div className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] font-medium text-slate-500">
        {subtitle}
      </div>
    )}
  </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>
);

const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><Landmark size={28} className="mx-auto mb-2 text-slate-300" /><h2 className="font-bold text-slate-700">{title}</h2><p className="mt-1 text-xs text-slate-400">{text}</p></div>
);

const LedgerSection: React.FC<{
  entries: LoanIncomeExpense[];
  loans: Loan[];
  selectedLoanId: string;
  onLoanChange: (loanId: string) => void;
  totalIncome: number;
  totalExpenses: number;
  categoryFilter: string;
  categoryOptions: string[];
  onCategoryChange: (category: string) => void;
  onAdd: (type: "income" | "expense") => void;
  onApplyIncomeToLoan?: (entry: LoanIncomeExpense) => void;
}> = ({
  entries,
  loans,
  selectedLoanId,
  onLoanChange,
  totalIncome,
  totalExpenses,
  categoryFilter,
  categoryOptions,
  onCategoryChange,
  onAdd,
  onApplyIncomeToLoan,
}) => {
  const balanceTotal = totalIncome + totalExpenses;
  const incomeWidth =
    balanceTotal > 0 ? `${(totalIncome / balanceTotal) * 100}%` : "0%";
  return (
    <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="block text-xs font-bold text-slate-600">
        Manage ledger for
        <select
          value={selectedLoanId}
          onChange={(event) => onLoanChange(event.target.value)}
          className={`${inputClassName} mt-1`}
        >
          <option value="all">All loans and general entries</option>
          {loans.map((loan) => (
            <option key={loan.id} value={loan.id}>
              {loan.id} · {loan.applicantType === "cooperative" ? "Cooperative" : "Individual"} · {loan.purpose}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        Select one loan to see and add entries for that loan only. Choose all
        loans for general, unlinked entries.
      </p>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Metric label="Total Income" value={money(totalIncome)} />
      <Metric label="Total Expenses" value={money(totalExpenses)} />
      <Metric label="Net" value={money(totalIncome - totalExpenses)} />
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700">Income vs expenses</span>
        <span className="text-slate-500">
          {balanceTotal > 0
            ? `${Math.round((totalIncome / balanceTotal) * 100)}% income`
            : "No transactions"}
        </span>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-red-100">
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: incomeWidth }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold">
        <span className="text-emerald-700">Income {money(totalIncome)}</span>
        <span className="text-red-700">Expenses {money(totalExpenses)}</span>
      </div>
    </div>
    <div className="flex gap-2">
      <button onClick={() => onAdd("income")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus size={14} /> Add Income</button>
      <button onClick={() => onAdd("expense")} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white"><Plus size={14} /> Add Expense</button>
    </div>
    <div>
      <p className="mb-1 text-xs font-bold text-slate-600">
        Filter by category
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onCategoryChange("all")}
          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
            categoryFilter === "all"
              ? "border-emerald-800 bg-emerald-800 text-white"
              : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          All
        </button>
        {categoryOptions.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
              categoryFilter === category
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Type</th>
            <th className="p-3">Category</th>
            <th className="p-3">Description</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50/50">
              <td className="p-3">{formatDate(entry.date)}</td>
              <td className={`p-3 font-bold ${entry.type === "income" ? "text-emerald-700" : "text-red-700"}`}>
                {entry.type}
              </td>
              <td className="p-3">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {entry.category}
                </span>
              </td>
              <td className="p-3">
                <div className="max-w-xs truncate text-slate-800" title={entry.description}>
                  {entry.description}
                </div>
                {entry.appliedToLoanId && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 size={11} /> Applied to {entry.appliedToLoanId}
                  </span>
                )}
                {entry.appliedFromIncomeId && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700">
                    Auto-deducted from income
                  </span>
                )}
              </td>
              <td className="p-3 text-right font-bold text-slate-900">
                {money(entry.amount)}
              </td>
              <td className="p-3 text-right">
                {entry.type === "income" && onApplyIncomeToLoan && (
                  entry.appliedToLoanId ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 size={11} /> Paid Loan
                    </span>
                  ) : (
                    <button
                      onClick={() => onApplyIncomeToLoan(entry)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-800"
                    >
                      <DollarSign size={12} /> Pay Loan
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-400">
                No ledger entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block text-xs font-bold text-slate-600">{label}<span className="mt-1 block">{children}</span></label>;
const ErrorText: React.FC<{ text: string }> = ({ text }) => <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{text}</p>;
const SubmitButton: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    aria-busy={loading}
    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {loading && <Loader2 size={16} className="animate-spin" />}
    {loading ? "Submitting..." : label}
  </button>
);
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
