import * as React from 'react';
import { cn } from '@/lib/utils.js';

function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-800/60', className)} {...props} />;
}

export { Skeleton };
