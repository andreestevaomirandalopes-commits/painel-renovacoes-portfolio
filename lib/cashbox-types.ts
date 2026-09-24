export type CashboxExpenseItem = {
  id: string;
  amount: string;
  description: string;
  establishment: string;
  purchaseDate: string;
  version: number;
};

export type CashboxSnapshot = {
  balance: string;
  totalSpentThisMonth: string;
  purchaseCount: number;
  version: number;
  expenses: CashboxExpenseItem[];
};
