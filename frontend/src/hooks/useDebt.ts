import { useState, useEffect, useCallback } from 'react';
import type { Loan, RepaymentRecord } from '@/types/debt';
import { calculateDebtSummary, generateId } from '@/lib/debt-calculator';

const LOANS_STORAGE_KEY = 'debt_loans';
const REPAYMENTS_STORAGE_KEY = 'debt_repayments';

export function useDebt() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 从本地存储加载数据
  useEffect(() => {
    const loadData = () => {
      try {
        const savedLoans = localStorage.getItem(LOANS_STORAGE_KEY);
        const savedRepayments = localStorage.getItem(REPAYMENTS_STORAGE_KEY);
        
        if (savedLoans) {
          setLoans(JSON.parse(savedLoans));
        }
        if (savedRepayments) {
          setRepayments(JSON.parse(savedRepayments));
        }
      } catch (error) {
        console.error('加载债务数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 保存到本地存储
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(loans));
    }
  }, [loans, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(REPAYMENTS_STORAGE_KEY, JSON.stringify(repayments));
    }
  }, [repayments, isLoading]);

  // 添加贷款
  const addLoan = useCallback((loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newLoan: Loan = {
      ...loanData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLoans(prev => [...prev, newLoan]);
    return newLoan;
  }, []);

  // 更新贷款
  const updateLoan = useCallback((id: string, updates: Partial<Loan>) => {
    setLoans(prev =>
      prev.map(loan =>
        loan.id === id
          ? { ...loan, ...updates, updatedAt: new Date().toISOString() }
          : loan
      )
    );
  }, []);

  // 删除贷款
  const deleteLoan = useCallback((id: string) => {
    setLoans(prev => prev.filter(loan => loan.id !== id));
    // 同时删除相关的还款记录
    setRepayments(prev => prev.filter(r => r.loanId !== id));
  }, []);

  // 添加还款记录
  const addRepayment = useCallback((repaymentData: Omit<RepaymentRecord, 'id' | 'createdAt'>) => {
    const newRepayment: RepaymentRecord = {
      ...repaymentData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setRepayments(prev => [...prev, newRepayment]);
    return newRepayment;
  }, []);

  // 删除还款记录
  const deleteRepayment = useCallback((id: string) => {
    setRepayments(prev => prev.filter(r => r.id !== id));
  }, []);

  // 获取某个贷款的所有还款记录
  const getRepaymentsByLoan = useCallback((loanId: string) => {
    return repayments.filter(r => r.loanId === loanId);
  }, [repayments]);

  // 获取统计数据
  const summary = calculateDebtSummary(loans);

  // 获取活跃贷款
  const activeLoans = loans.filter(loan => loan.status === 'active');

  // 获取已结清贷款
  const paidOffLoans = loans.filter(loan => loan.status === 'paid_off');

  return {
    loans,
    activeLoans,
    paidOffLoans,
    repayments,
    summary,
    isLoading,
    addLoan,
    updateLoan,
    deleteLoan,
    addRepayment,
    deleteRepayment,
    getRepaymentsByLoan,
  };
}
