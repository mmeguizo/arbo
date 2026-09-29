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
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Landmark,
  Loader2,
  Plus,
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

  const activeLoansCount = useMemo(
    () => loans.filter(
      (loan) =>
        loan.applicantId === user?.uid &&
        loan.applicantType === "individual" &&
        loan.status === "active",
    ).length,
    [loans, user?.uid],
  );
  const totalOutstanding = useMemo(
    () =>
      loans
        .filter(
          (loan) =>
            loan.applicantId === user?.uid &&
            loan.applicantType === "individual" &&
            loan.status === "active",
        )
        .reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0),
    [loans, user?.uid],
  );
  const nextDueDate = useMemo(() => {
    const dates = loans
      .filter(
        (loan) =>
          loan.applicantId === user?.uid &&
          loan.applicantType === "individual" &&
          loan.status === "active" &&
          loan.nextPaymentDue,
      )
      .map((loan) => loan.nextPaymentDue)
      .sort();
    return dates[0] || "";
  }, [loans, user?.uid]);
  const personalLoans = loans.filter(
    (loan) =>
      loan.applicantId === user?.uid && loan.applicantType === "individual",
  );
  const cooperativeLoans = loans.filter(
    (loan) => loan.applicantType === "cooperative",
  );
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
  const visibleLedgerEntries =
    selectedLedgerLoanId === "all"
      ? incomeExpenses
      : incomeExpenses.filter(
          (entry) => entry.loanId === selectedLedgerLoanId,
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
        status: amount >= paymentForEntry.amountDue ? "paid" : "partial",
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
        newStatus: amount >= paymentForEntry.amountDue ? "paid" : "partial",
        notes: `${profile.name} submitted a ${money(amount)} payment for loan ${paymentForLoan}.`,
      });
      await broadcastNotification(
        "admin",
        "payment_received",
        "Loan payment received",
        `${profile.name} submitted a ${money(amount)} payment for loan ${paymentForLoan}.`,
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
      await addDoc(collection(db, "loanIncomeExpenses"), {
        userId: profile.uid,
        userName: profile.name,
        type: incomeExpenseType,
        category: ieCategory,
        description: ieDescription.trim(),
        amount,
        date: new Date(ieDate).toISOString(),
        loanId: selectedLedgerLoanId === "all" ? null : selectedLedgerLoanId,
        receiptImage: receiptImage || null,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });
      setShowIncomeExpenseModal(false);
      setIeCategory("");
      setIeDescription("");
      setIeAmount("");
      setIeReceipt(null);
    } catch (error) {
      console.error("Failed to save ledger entry:", error);
      setFormError("Unable to save the ledger entry.");
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
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 grid place-items-center">
          <p className="text-sm text-slate-500">Loading loan records...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Active Loans" value={String(activeLoansCount)} icon={<Landmark size={18} />} />
            <SummaryCard label="Outstanding Balance" value={money(totalOutstanding)} icon={<DollarSign size={18} />} />
            <SummaryCard label="Next Due" value={nextDueDate ? formatDate(nextDueDate) : "—"} icon={<Calendar size={18} />} />
            <SummaryCard label="Net Profit" value={money(displayedNetProfit)} positive={displayedNetProfit >= 0} icon={displayedNetProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} />
          </div>

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
              {personalLoans.length === 0 && (
                <EmptyState
                  title="No individual loan applications yet"
                  text="Your personal My Loans area only contains individual loans. Cooperative loans are shown separately below."
                />
              )}
              {personalLoans.map((loan) => {
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
              {cooperativeLoans.length > 0 && (
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
                  {cooperativeLoans.map((loan) => {
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
              onAdd={(type) => {
                setIncomeExpenseType(type);
                setIeCategory("");
                setFormError(null);
                setShowIncomeExpenseModal(true);
              }}
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

      {showPaymentModal && paymentForEntry && (
        <Modal title={`Payment ${paymentForEntry.paymentNumber}`} onClose={() => setShowPaymentModal(false)}>
          <form onSubmit={handlePayment} className="space-y-4">
            <p className="text-xs text-slate-500">Due {formatDate(paymentForEntry.dueDate)} · {money(paymentForEntry.amountDue)}</p>
            {paymentForEntry.status === "disputed" && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                <p className="font-bold">Admin requested a correction</p>
                <p className="mt-1">
                  {paymentForEntry.disputeReason ||
                    "Please upload a corrected receipt and explain the correction."}
                </p>
              </div>
            )}
            <Field label="Amount paid">
              <input type="number" min="0.01" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} className={inputClassName} />
            </Field>
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
      )}

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
            <Field label="Receipt (optional)">
              <input type="file" accept="image/*" onChange={(event) => setIeReceipt(event.target.files?.[0] || null)} className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700`} />
            </Field>
            {formError && <ErrorText text={formError} />}
            <SubmitButton loading={submitting} label="Save Entry" />
          </form>
        </Modal>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; icon: React.ReactNode; positive?: boolean }> = ({ label, value, icon, positive = true }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`mb-2 flex items-center gap-2 ${positive ? "text-emerald-700" : "text-red-600"}`}>{icon}<span className="text-[10px] font-bold uppercase text-slate-400">{label}</span></div>
    <p className={`text-lg font-extrabold ${positive ? "text-slate-900" : "text-red-700"}`}>{value}</p>
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
  onAdd: (type: "income" | "expense") => void;
}> = ({
  entries,
  loans,
  selectedLoanId,
  onLoanChange,
  totalIncome,
  totalExpenses,
  onAdd,
}) => (
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
    <div className="flex gap-2">
      <button onClick={() => onAdd("income")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus size={14} /> Add Income</button>
      <button onClick={() => onAdd("expense")} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white"><Plus size={14} /> Add Expense</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">
        {entries.map((entry) => <tr key={entry.id}><td className="p-3">{formatDate(entry.date)}</td><td className={`p-3 font-bold ${entry.type === "income" ? "text-emerald-700" : "text-red-700"}`}>{entry.type}</td><td className="p-3">{entry.category}</td><td className="p-3">{entry.description}</td><td className="p-3 text-right font-bold">{money(entry.amount)}</td></tr>)}
        {entries.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No ledger entries yet.</td></tr>}
      </tbody></table>
    </div>
  </div>
);

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
