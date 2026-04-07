import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';
import { apiClient } from '@/lib/api-client';

async function fetchWeeklyPlan(weekStart: string) {
  const response = await apiClient.get(`/plans/week/${weekStart}`);
  return response.data.data || [];
}

export default function TestPlansPage() {
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

  const { data: weeklyPlans, isLoading, error } = useQuery({
    queryKey: ['weekly-plan', weekStartStr],
    queryFn: () => fetchWeeklyPlan(weekStartStr),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Weekly Plans</h1>
      <div>
        <h2 className="text-lg font-semibold mb-2">Weekly Plans Data:</h2>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
          {JSON.stringify(weeklyPlans, null, 2)}
        </pre>
      </div>
    </div>
  );
}