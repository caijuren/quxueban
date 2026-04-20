import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CheckCircle } from "lucide-react";
import type { Loan } from "@/types/debt";
import { repaymentMethodLabels, loanStatusLabels, loanStatusColors } from "@/types/debt";
import { formatAmount, formatNumber } from "@/lib/debt-calculator";
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
      
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">序号</TableHead>
              <TableHead>银行/机构</TableHead>
              <TableHead>还款方式</TableHead>
              <TableHead className="text-right">额度</TableHead>
              <TableHead className="text-right">利率</TableHead>
              <TableHead className="text-center">期限</TableHead>
              <TableHead className="text-center">剩余</TableHead>
              <TableHead className="text-right">月供</TableHead>
              <TableHead className="text-center">还款日</TableHead>
              <TableHead className="text-right">剩余总额</TableHead>
              <TableHead className="text-right">剩余本金</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>策略</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  暂无贷款记录
                </TableCell>
              </TableRow>
            ) : (
              sortedLoans.map((loan) => (
                <TableRow key={loan.id} className="hover:bg-muted/30">
                  <TableCell className="text-center font-medium">{loan.order}</TableCell>
                  <TableCell className="font-medium">{loan.bankName}</TableCell>
                  <TableCell>{repaymentMethodLabels[loan.repaymentMethod]}</TableCell>
                  <TableCell className="text-right">{formatAmount(loan.amount)}</TableCell>
                  <TableCell className="text-right">{loan.interestRate}%</TableCell>
                  <TableCell className="text-center">{loan.totalMonths}月</TableCell>
                  <TableCell className="text-center">{loan.remainingMonths}月</TableCell>
                  <TableCell className="text-right">{formatAmount(loan.monthlyPayment)}</TableCell>
                  <TableCell className="text-center">每月{loan.paymentDay}日</TableCell>
                  <TableCell className="text-right font-semibold text-amber-600">
                    {formatAmount(loan.remainingTotal)}
                  </TableCell>
                  <TableCell className="text-right">{formatAmount(loan.remainingPrincipal)}</TableCell>
                  <TableCell>
                    <Badge className={loanStatusColors[loan.status]}>
                      {loanStatusLabels[loan.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate" title={loan.strategy}>
                    {loan.strategy || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => onDelete(loan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
