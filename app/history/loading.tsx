import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-cream-100 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
