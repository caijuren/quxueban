import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { Select, Option } from "./ui/Select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./ui/Dialog";
import type { Loan, RepaymentMethod } from "@/types/debt";
import { repaymentMethodLabels } from "@/types/debt";
import { calculateEqualInterestPayment } from "@/lib/debt-calculator";

interface LoanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (loan: Omit<Loan, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: Partial<Loan>;
}

const repaymentMethods: RepaymentMethod[] = ["equal_interest", "equal_principal", "interest_first", "bullet"];

export function LoanForm({ open, onOpenChange, onSubmit, initialData }: LoanFormProps) {
  const [formData, setFormData] = useState({
    bankName: initialData?.bankName || "",
    order: initialData?.order || 1,
    repaymentMethod: initialData?.repaymentMethod || ("equal_interest" as RepaymentMethod),
    amount: initialData?.amount || 0,
    interestRate: initialData?.interestRate || 0,
    totalMonths: initialData?.totalMonths || 12,
    remainingMonths: initialData?.remainingMonths || 12,
    paymentDay: initialData?.paymentDay || 1,
    loanDate: initialData?.loanDate || new Date().toISOString().split("T")[0],
    dueDate: initialData?.dueDate || "",
    strategy: initialData?.strategy || "",
    status: initialData?.status || ("active" as const),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 自动计算相关字段
    const monthlyRate = formData.interestRate / 100 / 12;
    let monthlyPayment = 0;
    let totalInterest = 0;

    if (formData.repaymentMethod === "equal_interest") {
      monthlyPayment = calculateEqualInterestPayment(formData.amount, formData.interestRate, formData.totalMonths);
      totalInterest = monthlyPayment * formData.totalMonths - formData.amount;
    } else if (formData.repaymentMethod === "equal_principal") {
      const principalPerMonth = formData.amount / formData.totalMonths;
      monthlyPayment = principalPerMonth + formData.amount * monthlyRate;
      for (let i = 0; i < formData.totalMonths; i++) {
        const remainingPrincipal = formData.amount - principalPerMonth * i;
        totalInterest += remainingPrincipal * monthlyRate;
      }
    } else {
      monthlyPayment = formData.amount * monthlyRate;
      totalInterest = monthlyPayment * formData.totalMonths;
    }

    const annualInterest = totalInterest / (formData.totalMonths / 12);

    // 计算剩余金额
    const paidMonths = formData.totalMonths - formData.remainingMonths;
    let remainingPrincipal = formData.amount;
    let paidPrincipal = 0;

    if (formData.repaymentMethod === "equal_interest") {
      // 等额本息剩余本金计算较复杂，这里简化
      const monthlyPrincipal = monthlyPayment - formData.amount * monthlyRate;
      paidPrincipal = monthlyPrincipal * paidMonths;
      remainingPrincipal = Math.max(0, formData.amount - paidPrincipal);
    } else if (formData.repaymentMethod === "equal_principal") {
      const principalPerMonth = formData.amount / formData.totalMonths;
      paidPrincipal = principalPerMonth * paidMonths;
      remainingPrincipal = formData.amount - paidPrincipal;
    }

    const remainingInterest = totalInterest * (formData.remainingMonths / formData.totalMonths);
    const remainingTotal = remainingPrincipal + remainingInterest;

    onSubmit({
      ...formData,
      monthlyPayment,
      currentMonthPayment: monthlyPayment,
      annualInterest,
      totalInterest,
      remainingTotal,
      remainingPrincipal,
      remainingInterest,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{initialData ? "编辑贷款" : "添加贷款"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>银行/机构名称</Label>
            <Input
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="如：工商银行、招商银行"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>序号</Label>
            <Input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>还款方式</Label>
            <Select
              value={formData.repaymentMethod}
              onChange={(e) => setFormData({ ...formData, repaymentMethod: e.target.value as RepaymentMethod })}
            >
              {repaymentMethods.map((method) => (
                <Option key={method} value={method}>
                  {repaymentMethodLabels[method]}
                </Option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>贷款额度（元）</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>年利率（%）</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>贷款期限（月）</Label>
            <Input
              type="number"
              value={formData.totalMonths}
              onChange={(e) => setFormData({ ...formData, totalMonths: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>剩余月份</Label>
            <Input
              type="number"
              value={formData.remainingMonths}
              onChange={(e) => setFormData({ ...formData, remainingMonths: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>还款日（每月几号）</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={formData.paymentDay}
              onChange={(e) => setFormData({ ...formData, paymentDay: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>贷款日期</Label>
            <Input
              type="date"
              value={formData.loanDate}
              onChange={(e) => setFormData({ ...formData, loanDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>到期日期</Label>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Loan["status"] })}
            >
              <Option value="active">还款中</Option>
              <Option value="paid_off">已结清</Option>
              <Option value="overdue">逾期</Option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>策略/备注</Label>
          <Input
            value={formData.strategy}
            onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
            placeholder="如：优先还清、正常还款等"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
