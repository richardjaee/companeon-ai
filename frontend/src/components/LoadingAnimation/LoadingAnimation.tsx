'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface LoadingAnimationProps {
  size?: number;
}

export default function LoadingAnimation({ size = 24 }: LoadingAnimationProps) {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {

    import('../../../public/animations/pending.json').then((data) => {
      setAnimationData(data.default);
    });
  }, []);

  if (!animationData) {
    const spinnerSize = size < 50 ? 'w-6 h-6' : size < 100 ? 'w-8 h-8' : 'w-12 h-12';
    return <div className={`${spinnerSize} rounded-full border-[1px] border-t-transparent border-purple-600 animate-spin`}></div>;
  }

  return (
    <Lottie
      animationData={animationData}
      loop
      autoplay
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
