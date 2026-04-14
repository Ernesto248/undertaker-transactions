export type TransactionType = "deposit" | "withdrawal" | "transfer";

export type Transaction = {
  id: string;
  bank: string;
  accountName: string;
  senderName: string;
  amount: number;
  confirmationCode: string;
  createdAt: string;
  type: TransactionType;
  assignedRemeseroId?: string | null;
  assignedRemeseroNombre?: string | null;
};

export type Remesero = {
  id: string;
  nombre: string;
  precioActual: number;
  deudaActual: number;
  createdAt: string;
  updatedAt: string;
};

export type RemeseroAssignment = {
  id: string;
  transactionId: string;
  remeseroId: string;
  remeseroNombre: string;
  amountUsd: number;
  priceApplied: number;
  debtAmount: number;
  assignedAt: string;
};

export type RemeseroPayment = {
  id: string;
  remeseroId: string;
  amountPaid: number;
  debtBeforePayment?: number | null;
  debtAfterPayment?: number | null;
  note: string | null;
  paidAt: string;
  revertedAt: string | null;
  revertedReason: string | null;
};

export type RemeseroShareSummaryGroup = {
  priceApplied: number;
  amountsUsd: number[];
  txCount: number;
  totalUsd: number;
  totalCup: number;
};

export type RemeseroShareSummary = {
  remeseroId: string;
  remeseroNombre: string;
  cutAt: string | null;
  hasPaymentCut: boolean;
  lastPaymentAmount: number | null;
  inicioDebt: number;
  totalTiradoUsd: number;
  totalTiradoCup: number;
  finalDebt: number;
  finalDebtType: "DEUDA" | "FONDO";
  groups: RemeseroShareSummaryGroup[];
};

export type RemeseroDetailRangeOption = {
  id: string;
  label: string;
  from: string | null;
  to: string | null;
};

export type RemeseroDetailAssignment = {
  assignmentId: string;
  transactionId: string;
  senderName: string;
  bank: string | null;
  accountName: string | null;
  confirmationCode: string | null;
  transactionAmount: number;
  amountUsd: number;
  priceApplied: number;
  debtAmount: number;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
};

export type RemeseroDetailSummaryGroup = {
  priceApplied: number;
  txCount: number;
  totalUsd: number;
  totalCup: number;
  amountsUsd: number[];
};

export type RemeseroDetailSummary = {
  txCount: number;
  totalUsd: number;
  totalCup: number;
  groups: RemeseroDetailSummaryGroup[];
};

export type RemeseroDetailData = {
  remesero: Remesero;
  payments: RemeseroPayment[];
  rangeOptions: RemeseroDetailRangeOption[];
  selectedRange: {
    from: string | null;
    to: string | null;
  };
  summary: RemeseroDetailSummary;
  assignments: RemeseroDetailAssignment[];
};

export type AccountMovementType = "wire" | "expense";

export type AccountBalance = {
  id: string;
  accountName: string;
  incomingTotal: number;
  outgoingTotal: number;
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
};

export type AccountMovement = {
  id: string;
  accountId: string;
  movementType: AccountMovementType;
  amount: number;
  note: string | null;
  createdAt: string;
  revertedAt: string | null;
  revertedReason: string | null;
};
