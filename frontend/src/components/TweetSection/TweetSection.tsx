'use client';

import Container from '@/components/Layout/Container';

const PROFILE_IMG = 'https://pbs.twimg.com/profile_images/1903094269398687744/uYBqOz3H_normal.jpg';

const XLogo = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" className="flex-shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
  </svg>
);

const GoldCheckmark = () => (
  <svg viewBox="0 0 22 22" width="18" height="18" className="flex-shrink-0">
    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.261.272 1.893.143.634-.131 1.22-.434 1.69-.88.445-.47.75-1.055.88-1.69.131-.634.084-1.29-.139-1.896.587-.275 1.084-.706 1.438-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#E8A700" />
  </svg>
);

const TWEETS = [
  {
    id: '2014352928941674728',
    text: 'Best Integration - New Project\n\n1st Place - Companeon\n2nd Place - Echelon\n3rd Place - ShoehornFi',
    date: '7:02 AM \u00b7 Jan 22, 2026',
  },
  {
    id: '2017311922928914791',
    text: '\u201cThis is what makes Advanced Permissions super powerful\u201d\n\n@richardjaey showcased Companeon, a conversational AI agent for crypto wallets, during the January @MetaMaskDev Community Call.',
    date: '11:00 AM \u00b7 Jan 30, 2026',
  },
];

function TweetText({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <p className="text-[15px] leading-[22px] text-[#0f1419] whitespace-pre-line">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-[#1d9bf0] hover:underline">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default function TweetSection() {
  return (
    <div className="bg-gray-50 py-24">
      <Container>
        <div className="text-center mb-16">
          <p className="text-[32px] lg:text-[42px] max-w-5xl mx-auto font-medium text-black leading-tight font-[family-name:var(--font-space-grotesk)]">
            Trusted by MetaMask
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch max-w-3xl mx-auto">
          {TWEETS.map((tweet) => (
            <a
              key={tweet.id}
              href={`https://x.com/MetaMaskDev/status/${tweet.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white rounded-2xl border border-[#e1e8ed] p-4 flex flex-col hover:bg-gray-50 transition-colors cursor-pointer"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={PROFILE_IMG}
                    alt="MetaMask Developer"
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="leading-tight">
                    <div className="flex items-center gap-0.5">
                      <span className="font-bold text-[15px] text-[#0f1419]">MetaMask Developer</span>
                      <GoldCheckmark />
                    </div>
                    <span className="text-[15px] text-[#536471]">@MetaMaskDev</span>
                  </div>
                </div>
                <XLogo />
              </div>

              {/* Body */}
              <div className="flex-1">
                <TweetText text={tweet.text} />
              </div>

              {/* Date */}
              <div className="mt-3">
                <span className="text-[15px] text-[#536471]">{tweet.date}</span>
              </div>
            </a>
          ))}
        </div>
      </Container>
    </div>
  );
}
