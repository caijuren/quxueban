import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Calendar, Wallet, CreditCard, ArrowDown, Clock } from "lucide-react";
import type { DebtSummary } from "@/types/debt";
import { formatAmount, formatNumber } from "@/lib/debt-calculator";

interface SummaryCardsProps {
  summary: DebtSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      title: "待还总额",
      value: formatAmount(summary.totalRemaining),
      icon: Wallet,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "待还本金",
      value: formatAmount(summary.totalPrincipal),
      icon: CreditCard,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "每月应还",
      value: formatAmount(summary.monthlyPayment),
      icon: Calendar,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
    },
    {
      title: "当月已还",
      value: formatAmount(summary.paidThisMonth),
      icon: TrendingDown,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "本月降低",
      value: formatAmount(summary.reducedThisMonth),
      icon: ArrowDown,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
    },
    {
      title: "上岸时间",
      value: `${summary.daysToPayoff} 天`,
      subValue: summary.payoffDate,
      icon: Clock,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`${card.bgColor} p-2 rounded-lg`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.subValue && (
              <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
