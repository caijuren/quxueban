import { useState } from "react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Edit, Trash2 } from "lucide-react";
import type { Loan } from "@/types/debt";
import { repaymentMethodLabels, loanStatusLabels, loanStatusColors } from "@/types/debt";
import { formatAmount } from "@/lib/debt-calculator";
import { LoanForm } from "./LoanForm";

interface LoanTableProps {
  loans: Loan[];
  onUpdate: (id: string, updates: Partial<Loan>) => void;
  onDelete: (id: string) => void;
  title?: string;
}

export function LoanTable({ loans, onUpdate, onDelete, title = "贷款列表" }: LoanTableProps) {
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (loanData: Omit<Loan, "id" | "createdAt" | "updatedAt">) => {
    if (editingLoan) {
      onUpdate(editingLoan.id, loanData);
    }
    setEditingLoan(null);
  };

  const sortedLoans = [...loans].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center font-medium text-gray-700">序号</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">银行/机构</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">还款方式</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">额度</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">利率</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">期限</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">剩余</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">月供</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">还款日</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">剩余总额</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">剩余本金</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">策略</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedLoans.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-8 text-gray-500">
                  暂无贷款记录
                </td>
              </tr>
            ) : (
              sortedLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center font-medium">{loan.order}</td>
                  <td className="px-4 py-3 font-medium">{loan.bankName}</td>
                  <td className="px-4 py-3">{repaymentMethodLabels[loan.repaymentMethod]}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(loan.amount)}</td>
                  <td className="px-4 py-3 text-right">{loan.interestRate}%</td>
                  <td className="px-4 py-3 text-center">{loan.totalMonths}月</td>
                  <td className="px-4 py-3 text-center">{loan.remainingMonths}月</td>
                  <td className="px-4 py-3 text-right">{formatAmount(loan.monthlyPayment)}</td>
                  <td className="px-4 py-3 text-center">每月{loan.paymentDay}日</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">
                    {formatAmount(loan.remainingTotal)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatAmount(loan.remainingPrincipal)}</td>
                  <td className="px-4 py-3">
                    <Badge className={loanStatusColors[loan.status]}>
                      {loanStatusLabels[loan.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 max-w-[120px] truncate" title={loan.strategy}>
                    {loan.strategy || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDelete(loan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoanForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        initialData={editingLoan || undefined}
      />
    </div>
  );
}
