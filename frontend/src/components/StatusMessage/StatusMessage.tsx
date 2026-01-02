import Container from '@/components/Layout/Container';

interface StatusMessageProps {
  title: string;
  message: string;
  warningMessage?: string;
  type?: 'warning' | 'error';
}

export function StatusMessage({ 
  title, 
  message, 
  warningMessage, 
  type = 'warning' 
}: StatusMessageProps) {
  return (
    <Container>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="text-gray-600">{message}</p>
        {warningMessage && (
          <div className={`${
            type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'
          } border rounded-lg p-4 mt-4`}>
            <p className="text-sm">{warningMessage}</p>
          </div>
        )}
      </div>
    </Container>
  );
}

export function WalletConnectMessage() {
  return (
    <StatusMessage
      title="Connect wallet"
      message="Please connect your wallet to access this page"
      warningMessage="You need to connect your Ethereum wallet to use the assistant"
      type="warning"
    />
  );
}

export function AccessDeniedMessage() {
  return (
    <StatusMessage
      title="Access denied"
      message="You don't have permission to access this page"
      warningMessage="Please ensure you have the required permissions or contact support for assistance"
      type="error"
    />
  );
}

export function InvalidSignatureMessage() {
  return (
    <StatusMessage
      title="Invalid signature"
      message="The signature verification has failed or your current session has expired"
      warningMessage="Please ensure you have connected the correct wallet and try signing the authentication message again"
      type="error"
    />
  );
} 

export function PaymentRequiredMessage() {
  return (
    <StatusMessage
      title="Payment required"
      message="You need to complete payment to access this page"
      warningMessage="Your subscription payment has not been confirmed. Please complete the payment process to continue."
      type="error"
    />
  );
}

export function ErrorMessage() {
  return (
    <StatusMessage
      title="Something went wrong"
      message="We've encountered an unexpected issue. Please try refreshing the page."
      warningMessage="If this problem persists, please contact support for assistance."
      type="error"
    />
  );
}

export function WalletMismatchMessage() {
  return (
    <StatusMessage
      title="Wallet mismatch"
      message="The connected wallet doesn't match the expected wallet for this session"
      warningMessage="Please switch to the correct wallet account in MetaMask and refresh the page. Make sure you're connected with the intended wallet."
      type="error"
    />
  );
}
