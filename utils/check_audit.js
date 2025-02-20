const { exec } = require('child_process');

const URL_LIST = [
  // Not encountered by Vite, thus we cannot hit it
  'https://github.com/advisories/GHSA-67mh-4wv8-2f99'
];

const runNpmAudit = () => new Promise((resolve, reject) => {
  exec('npm audit --omit dev --json', (error, stdout, stderr) => {
    if (error && stderr) {
      // npm audit returns a non-zero exit code if there are vulnerabilities
      reject(`Audit error: ${error}\n${stdout}\n${stderr}`);
      return;
    }
    resolve(stdout);
  });
});

// interface Audit {
//   [name: string]: AuditEntry;
// }

// interface AuditEntry {
//   severity: string;
//   range: string;
//   via: Array<{
//     url: string;
//   } | string>;
// }

const checkAudit = async () => {
  const audit = JSON.parse(await runNpmAudit());

  const validVulnerabilities = Object.entries(audit.vulnerabilities).filter(([_name, entry]) => {
    const originalVulnerabilities = entry.via.filter(viaEntry => typeof viaEntry === 'object' && !URL_LIST.includes(viaEntry.url));
    return originalVulnerabilities.length > 0;
  });

  for (const [name, entry] of validVulnerabilities) {
    console.error(`Vulnerability (${entry.severity}): ${name} ${entry.range}`);
  }

  if (validVulnerabilities.length > 0) {
    process.exit(1);
  }

  console.log('No vulnerabilities found');
};

// You can manually run `npm audit --omit dev` to see the vulnerabilities in a human-friendly
checkAudit().catch(error => {
  console.error(error);
  process.exit(1);
});
