export type RepaymentMethod = 'equal_interest' | 'equal_principal' | 'interest_first' | 'bullet';

export type LoanStatus = 'active' | 'paid_off' | 'overdue';

export interface Loan {
  id: string;
  bankName: string;
  order: number;
  repaymentMethod: RepaymentMethod;
  amount: number;
  interestRate: number;
  totalMonths: number;
  remainingMonths: number;
  annualInterest: number;
  totalInterest: number;
  monthlyPayment: number;
  currentMonthPayment: number;
  paymentDay: number;
  remainingTotal: number;
  remainingPrincipal: number;
  remainingInterest: number;
  loanDate: string;
  dueDate: string;
  strategy: string;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentRecord {
  id: string;
  loanId: string;
  month: string;
  amount: number;
  paymentDate: string;
  period: number;
  principal: number;
  interest: number;
  note: string;
  createdAt: string;
}

export interface DebtSummary {
  totalRemaining: number;
  totalPrincipal: number;
  monthlyPayment: number;
  paidThisMonth: number;
  borrowedLastMonth: number;
  reducedThisMonth: number;
  payoffDate: string;
  daysToPayoff: number;
}

export const repaymentMethodLabels: Record<RepaymentMethod, string> = {
  equal_interest: '等额本息',
  equal_principal: '等额本金',
  interest_first: '先息后本',
  bullet: '到期还本',
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  active: '还款中',
  paid_off: '已结清',
  overdue: '逾期',
};

export const loanStatusColors: Record<LoanStatus, string> = {
  active: 'bg-green-100 text-green-800',
  paid_off: 'bg-gray-100 text-gray-800',
  overdue: 'bg-red-100 text-red-800',
};
