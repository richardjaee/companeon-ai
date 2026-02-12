'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Container from '@/components/Layout/Container';
import Footer from '@/components/Footer/Footer';

interface LegalPageProps {
  content: string;
}

export default function LegalPage({ content }: LegalPageProps) {
  return (
    <div className="bg-[#f2f2f2] min-h-screen">
      <div className="py-12">
        <Container>
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </Container>
      </div>
      <Footer />
    </div>
  );
}
