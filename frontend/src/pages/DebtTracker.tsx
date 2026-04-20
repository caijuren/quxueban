import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, Upload } from "lucide-react";
import { useDebt } from "@/hooks/useDebt";
import { SummaryCards } from "@/components/debt/SummaryCards";
import { LoanForm } from "@/components/debt/LoanForm";
import { LoanTable } from "@/components/debt/LoanTable";
import type { Loan } from "@/types/debt";
import { toast } from "sonner";

export default function DebtTracker() {
  const {
    activeLoans,
    paidOffLoans,
    summary,
    isLoading,
    addLoan,
    updateLoan,
    deleteLoan,
  } = useDebt();

  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAddLoan = (loanData: Omit<Loan, "id" | "createdAt" | "updatedAt">) => {
    addLoan(loanData);
    toast.success("贷款添加成功");
  };

  const handleUpdateLoan = (id: string, updates: Partial<Loan>) => {
    updateLoan(id, updates);
    toast.success("贷款更新成功");
  };

  const handleDeleteLoan = (id: string) => {
    if (confirm("确定要删除这条贷款记录吗？")) {
      deleteLoan(id);
      toast.success("贷款删除成功");
    }
  };

  const handleExport = () => {
    const data = {
      loans: [...activeLoans, ...paidOffLoans],
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debt-data-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("数据导出成功");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">还款记录工具</h1>
          <p className="text-muted-foreground mt-1">
            管理你的贷款和还款计划，早日上岸！
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            添加贷款
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <SummaryCards summary={summary} />

      {/* 贷款列表 */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active">
            还款中 ({activeLoans.length})
          </TabsTrigger>
          <TabsTrigger value="paidoff">
            已结清 ({paidOffLoans.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <LoanTable
            loans={activeLoans}
            onUpdate={handleUpdateLoan}
            onDelete={handleDeleteLoan}
            title="还款中贷款"
          />
        </TabsContent>

        <TabsContent value="paidoff" className="mt-6">
          <LoanTable
            loans={paidOffLoans}
            onUpdate={handleUpdateLoan}
            onDelete={handleDeleteLoan}
            title="已结清贷款"
          />
        </TabsContent>
      </Tabs>

      {/* 添加贷款表单 */}
      <LoanForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleAddLoan}
      />
    </div>
  );
}
