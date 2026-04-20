import type { Loan, RepaymentMethod, DebtSummary } from '@/types/debt';

/**
 * 计算等额本息月供
 */
export function calculateEqualInterestPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

/**
 * 计算等额本金月供（首月）
 */
export function calculateEqualPrincipalPayment(
  principal: number,
  annualRate: number,
  months: number,
  currentMonth: number = 1
): number {
  const monthlyRate = annualRate / 100 / 12;
  const principalPerMonth = principal / months;
  const remainingPrincipal = principal - principalPerMonth * (currentMonth - 1);
  const interest = remainingPrincipal * monthlyRate;
  
  return principalPerMonth + interest;
}

/**
 * 计算先息后本月供
 */
export function calculateInterestFirstPayment(
  principal: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  return principal * monthlyRate;
}

/**
 * 计算到期还本（每月利息）
 */
export function calculateBulletPayment(
  principal: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  return principal * monthlyRate;
}

/**
 * 计算贷款总利息
 */
export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  months: number,
  method: RepaymentMethod
): number {
  const monthlyRate = annualRate / 100 / 12;
  
  switch (method) {
    case 'equal_interest': {
      const monthlyPayment = calculateEqualInterestPayment(principal, annualRate, months);
      return monthlyPayment * months - principal;
    }
    case 'equal_principal': {
      const principalPerMonth = principal / months;
      let totalInterest = 0;
      for (let i = 0; i < months; i++) {
        const remainingPrincipal = principal - principalPerMonth * i;
        totalInterest += remainingPrincipal * monthlyRate;
      }
      return totalInterest;
    }
    case 'interest_first':
      return principal * monthlyRate * months;
    case 'bullet':
      return principal * monthlyRate * months;
    default:
      return 0;
  }
}

/**
 * 计算每月还款额
 */
export function calculateMonthlyPayment(
  loan: Loan,
  currentMonth: number = 1
): number {
  switch (loan.repaymentMethod) {
    case 'equal_interest':
      return calculateEqualInterestPayment(loan.amount, loan.interestRate, loan.totalMonths);
    case 'equal_principal':
      return calculateEqualPrincipalPayment(loan.amount, loan.interestRate, loan.totalMonths, currentMonth);
    case 'interest_first':
      return calculateInterestFirstPayment(loan.amount, loan.interestRate);
    case 'bullet':
      return calculateBulletPayment(loan.amount, loan.interestRate);
    default:
      return 0;
  }
}

/**
 * 计算债务汇总数据
 */
export function calculateDebtSummary(loans: Loan[]): DebtSummary {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const activeLoans = loans.filter(loan => loan.status === 'active');
  
  const totalRemaining = activeLoans.reduce((sum, loan) => sum + loan.remainingTotal, 0);
  const totalPrincipal = activeLoans.reduce((sum, loan) => sum + loan.remainingPrincipal, 0);
  const monthlyPayment = activeLoans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  
  // 计算当月已还（这里简化处理，实际应该从还款记录中计算）
  const paidThisMonth = 0;
  
  // 上月借贷（简化处理）
  const borrowedLastMonth = 0;
  
  // 本月降低（简化处理）
  const reducedThisMonth = 0;
  
  // 计算上岸时间（取最晚的到期日）
  let maxDueDate = now;
  activeLoans.forEach(loan => {
    const dueDate = new Date(loan.dueDate);
    if (dueDate > maxDueDate) {
      maxDueDate = dueDate;
    }
  });
  
  const payoffDate = maxDueDate.toISOString().split('T')[0];
  const daysToPayoff = Math.ceil((maxDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    totalRemaining,
    totalPrincipal,
    monthlyPayment,
    paidThisMonth,
    borrowedLastMonth,
    reducedThisMonth,
    payoffDate,
    daysToPayoff,
  };
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 格式化金额
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * 格式化数字（不带货币符号）
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
