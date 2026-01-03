
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://4db13b3713a8511ab70bda363d69b33a@o4509105767972864.ingest.us.sentry.io/4509105769742336",

  tracesSampleRate: 1,

  debug: false,

  // Filter out known attack patterns to reduce noise
  beforeSend(event, hint) {
    const errorMessage = event.exception?.values?.[0]?.value || '';
    const errorType = event.exception?.values?.[0]?.type || '';

    // Ignore known exploit attempts
    const attackPatterns = [
      /笀/, // Malformed UTF-16 characters (CVE-2025-55182)
      /not valid JSON/, // JSON parsing errors from malformed payloads
      /Unexpected token.*is not valid JSON/, // Specific Next.js RSC error
      /text\/x-component/, // React Server Component attacks
      /child_process/, // Server Action exploit attempts
      /Could not find the module.*in the React Server Manifest/, // Server Action bundler exploits
      /execSync/, // Shell command execution attempts
      /formaction/, // Malicious form action attacks
    ];

    // Check if error matches any attack pattern
    for (const pattern of attackPatterns) {
      if (pattern.test(errorMessage) || pattern.test(errorType)) {
        // This is a blocked attack attempt, don't log to Sentry
        
        return null;
      }
    }

    return event;
  },
});
