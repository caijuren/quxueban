import { TrendingDown, Calendar, Wallet, CreditCard, ArrowDown, Clock } from "lucide-react";
import type { DebtSummary } from "@/types/debt";
import { formatAmount } from "@/lib/debt-calculator";

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
        <div
          key={card.title}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{card.title}</span>
            <div className={`${card.bgColor} p-2 rounded-lg`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{card.value}</div>
          {card.subValue && (
            <p className="text-xs text-gray-500 mt-1">{card.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
}
