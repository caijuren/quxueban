import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SimpleAchievementsPage() {
  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1"></div>
          <div className="flex gap-2">
            <Button
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm min-w-20"
            >
              添加成就
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {[
          { label: '总成就', value: 0, gradient: 'from-primary to-primary/70' },
          { label: '已启用', value: 0, gradient: 'from-emerald-500 to-teal-500' },
          { label: '已解锁', value: 0, gradient: 'from-amber-500 to-yellow-500' }
        ].map((stat, index) => (
          <div key={stat.label}>
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden">
              <CardContent className="p-5 text-center relative overflow-hidden">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <Card className="border-0 shadow-lg rounded-3xl mt-4">
        <CardContent className="py-16 text-center">
          <h3 className="font-semibold text-gray-900 text-lg">还没有创建成就</h3>
          <p className="text-gray-500 mt-1">创建成就来激励孩子学习</p>
          <Button className="mt-4 rounded-xl bg-primary text-primary-foreground">添加成就</Button>
        </CardContent>
      </Card>
    </div>
  );
}