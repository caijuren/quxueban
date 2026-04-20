import { useState } from "react";
import { Button } from "./components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/Tabs";
import { Plus, Download } from "lucide-react";
import { useDebt } from "./hooks/useDebt";
import { SummaryCards } from "./components/SummaryCards";
import { LoanForm } from "./components/LoanForm";
import { LoanTable } from "./components/LoanTable";
import type { Loan } from "./types/debt";

function App() {
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
  const [activeTab, setActiveTab] = useState("active");

  const handleAddLoan = (loanData: Omit<Loan, "id" | "createdAt" | "updatedAt">) => {
    addLoan(loanData);
    alert("贷款添加成功");
  };

  const handleUpdateLoan = (id: string, updates: Partial<Loan>) => {
    updateLoan(id, updates);
    alert("贷款更新成功");
  };

  const handleDeleteLoan = (id: string) => {
    if (confirm("确定要删除这条贷款记录吗？")) {
      deleteLoan(id);
      alert("贷款删除成功");
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
    alert("数据导出成功");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">还款记录工具</h1>
            <p className="text-gray-500 mt-1">
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
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <Tabs defaultValue="active">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger
                value="active"
                isActive={activeTab === "active"}
                onClick={() => setActiveTab("active")}
              >
                还款中 ({activeLoans.length})
              </TabsTrigger>
              <TabsTrigger
                value="paidoff"
                isActive={activeTab === "paidoff"}
                onClick={() => setActiveTab("paidoff")}
              >
                已结清 ({paidOffLoans.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" isActive={activeTab === "active"}>
              <LoanTable
                loans={activeLoans}
                onUpdate={handleUpdateLoan}
                onDelete={handleDeleteLoan}
                title="还款中贷款"
              />
            </TabsContent>

            <TabsContent value="paidoff" isActive={activeTab === "paidoff"}>
              <LoanTable
                loans={paidOffLoans}
                onUpdate={handleUpdateLoan}
                onDelete={handleDeleteLoan}
                title="已结清贷款"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* 添加贷款表单 */}
        <LoanForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleAddLoan}
        />
      </div>
    </div>
  );
}

export default App;
