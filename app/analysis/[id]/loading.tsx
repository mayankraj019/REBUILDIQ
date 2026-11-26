import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AnalysisWorkspaceLoading() {
  return (
    <div className="min-h-screen bg-cream-100 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
