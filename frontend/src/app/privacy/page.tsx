import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import LegalPage from '@/components/Legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Companeon',
  description: 'Privacy Policy for the Companeon AI crypto agent platform.',
  alternates: { canonical: 'https://companeon.io/privacy' },
};

export default function PrivacyPage() {
  const filePath = path.join(process.cwd(), 'src/content/legal/privacy.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return <LegalPage content={content} />;
}
