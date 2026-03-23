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
  note: string | null;
  paidAt: string;
  revertedAt: string | null;
  revertedReason: string | null;
};
