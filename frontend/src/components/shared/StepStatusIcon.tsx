'use client';

import Image from 'next/image';

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

export default function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="flex items-center justify-center w-6 h-6">
        <Image
          src="/check-circle.png"
          alt="Completed"
          width={24}
          height={24}
          className="w-6 h-6"
        />
      </div>
    );
  }

  if (status === 'error') {
    return null;
  }

  return null;
}

