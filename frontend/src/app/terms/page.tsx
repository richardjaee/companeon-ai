import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import LegalPage from '@/components/Legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Companeon',
  description: 'Terms of Service for using the Companeon AI crypto agent platform.',
  alternates: { canonical: 'https://companeon.io/terms' },
};

export default function TermsPage() {
  const filePath = path.join(process.cwd(), 'src/content/legal/terms.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return <LegalPage content={content} />;
}
