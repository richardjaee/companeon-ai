'use client';

import LoadingAnimation from '@/components/LoadingAnimation/LoadingAnimation';
import StepStatusIcon from './StepStatusIcon';

type Step = {
  title: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  txHash?: string;
};

type SigningSubstep = 'waiting-for-signature' | 'processing-signature' | 'complete' | 'error' | null;
type ZkProofStage = 'pending' | 'waiting_signature' | 'generating' | 'completed' | undefined;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function StepList({
  steps,
  signingSubstep,
  zkProofStage,
  isTransactionSubmitted,
  signatureExpiry,
  getEtherscanLink,
  keyManagementType,
  kmsCommitment,
  commitmentMatched,
  customStep2Message
}: {
  steps: Step[];
  signingSubstep?: SigningSubstep;
  zkProofStage?: ZkProofStage;
  isTransactionSubmitted?: boolean;
  signatureExpiry?: number | null;
  getEtherscanLink: (txHash: string) => string;
  keyManagementType?: 'Self custody' | 'Companeon zero knowledge keys';
  kmsCommitment?: string | null;
  commitmentMatched?: boolean | null;
  customStep2Message?: string;
}) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-base ${
                  step.status === 'completed'
                    ? 'text-black'
                    : step.status === 'error'
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
              {step.status === 'loading' && (
                <div className="w-6 h-6 ml-3">
                  <LoadingAnimation size={24} />
                </div>
              )}
              {(step.status === 'completed' || step.status === 'error') && (
                <div className="ml-3 -mt-px">
                  <StepStatusIcon status={step.status} />
                </div>
              )}
            </div>

            {step.status === 'loading' && (
              <p className="text-sm text-gray-500 mt-1 italic">
                {step.txHash
                  ? 'Waiting for blockchain confirmation...'
                  : index === 1 && customStep2Message
                  ? customStep2Message
                  : index === 1 && signingSubstep === 'processing-signature'
                  ? 'Recreating key...'
                  : index === 1 && zkProofStage === 'generating'
                  ? 'Generating ZK proof...'
                  : index === 1 && (zkProofStage === 'waiting_signature' || signingSubstep === 'waiting-for-signature')
                  ? 'Waiting for wallet signature...'
                  : index === 2 && isTransactionSubmitted
                  ? 'Waiting for blockchain confirmation...'
                  : index === 2 && !isTransactionSubmitted && signatureExpiry
                  ? `Waiting for wallet signature... (Expiring: ${formatTime(
                      Math.max(0, signatureExpiry - Math.floor(Date.now() / 1000))
                    )})`
                  : 'Waiting for wallet signature...'}
              </p>
            )}

            {step.txHash && step.status === 'completed' && (
              <a
                href={getEtherscanLink(step.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                View transaction on Etherscan →
              </a>
            )}

            {index === 1 && step.status === 'completed' && keyManagementType === 'Companeon zero knowledge keys' && (
              <p className="text-sm text-gray-500 mt-1">Authorization signed</p>
            )}

            {index === 1 && step.status === 'completed' && kmsCommitment && (
              <>
                <p className="text-sm text-gray-500 mt-1">
                  Commitment verified: {kmsCommitment.slice(0, 10)}...{kmsCommitment.slice(-8)}
                </p>
                {commitmentMatched && (
                  <p className="text-sm text-gray-400 mt-0.5">✓ KMS commitment matched successfully</p>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
