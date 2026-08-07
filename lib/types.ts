export type TransactionType = "deposit" | "withdrawal" | "transfer";

export type Bank = {
  id: string;
  name: string;
};

export type GmailAccountOption = {
  id: string;
  accountName: string;
};

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

export type RemeseroDebtAdjustment = {
  id: string;
  remeseroId: string;
  debtBefore: number;
  debtAfter: number;
  note: string | null;
  adjustedAt: string;
};

export type RemeseroCutType = "PAYMENT" | "MANUAL";

export type RemeseroCut = {
  id: string;
  type: RemeseroCutType;
  cutAt: string;
  balanceAfter: number | null;
  amountPaid: number | null;
  note: string | null;
};

export type RemeseroShareSummaryGroup = {
  priceApplied: number;
  amountsUsd: number[];
  txCount: number;
  totalUsd: number;
  totalCup: number;
  movementCount?: number;
};

export type RemeseroShareSummary = {
  remeseroId: string;
  remeseroNombre: string;
  cutAt: string | null;
  cutType?: RemeseroCutType | null;
  cutNote?: string | null;
  hasPaymentCut: boolean;
  hasManualCut?: boolean;
  lastPaymentAmount: number | null;
  inicioDebt: number;
  totalTiradoUsd: number;
  totalTiradoCup: number;
  finalDebt: number;
  finalDebtType: "DEUDA" | "FONDO";
  netOperationCount?: number;
  movementCount?: number;
  groups: RemeseroShareSummaryGroup[];
  removedGroups: RemeseroShareSummaryGroup[];
  netGroups?: RemeseroShareSummaryGroup[];
};

export type RemeseroDetailRangeOption = {
  id: string;
  label: string;
  from: string | null;
  to: string | null;
  cutType?: RemeseroCutType | null;
  inicioDebt?: number;
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
  assignedInRange?: boolean;
  unassignedInRange?: boolean;
  movementCount?: number;
  netOperations?: number;
  netAmountUsd?: number;
  netDebtAmount?: number;
};

export type RemeseroDetailSummaryGroup = {
  priceApplied: number;
  txCount: number;
  totalUsd: number;
  totalCup: number;
  amountsUsd: number[];
  movementCount?: number;
};

export type RemeseroDetailSummary = {
  txCount: number;
  movementCount?: number;
  totalUsd: number;
  totalCup: number;
  groups: RemeseroDetailSummaryGroup[];
};

export type RemeseroDetailData = {
  remesero: Remesero;
  payments: RemeseroPayment[];
  adjustments?: RemeseroDebtAdjustment[];
  cuts?: RemeseroCut[];
  rangeOptions: RemeseroDetailRangeOption[];
  selectedRange: {
    from: string | null;
    to: string | null;
    inicioDebt?: number;
    cutType?: RemeseroCutType | null;
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
