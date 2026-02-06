export type TransactionType = "deposit" | "withdrawal" | "transfer"

export type Transaction = {
  id: string
  bank: string
  accountName: string
  senderName: string
  amount: number
  confirmationCode: string
  createdAt: string
  type: TransactionType
}
