const { exec } = require('child_process');

const URL_LIST = [
  // Not encountered by Vite, thus we cannot hit it
  'https://github.com/advisories/GHSA-67mh-4wv8-2f99'
];

const runNpmAudit = () => new Promise((resolve, reject) => {
  exec('npm audit --omit dev --json', (error, stdout, stderr) => {
    // npm audit returns non-zero exit code when vulnerabilities exist
    // We still want to parse the JSON output, so only reject on actual errors
    if (error && !stdout) {
      reject(new Error(`Audit command failed: ${stderr || error.message}`));
      return;
    }
    resolve(stdout);
  });
});

// interface Audit {
//   vulnerabilities: {
//     [name: string]: AuditEntry;
//   };
// }

// interface AuditEntry {
//   severity: string;
//   range: string;
//   via: Array<{
//     url: string;
//   } | string>;
// }

const checkAudit = async () => {
  try {
    const auditOutput = await runNpmAudit();
    const audit = JSON.parse(auditOutput);

    // Check if vulnerabilities property exists
    if (!audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
      console.log('No vulnerabilities found');
      return;
    }

    const validVulnerabilities = Object.entries(audit.vulnerabilities).filter(([_name, entry]) => {
      // Ensure entry.via exists and is an array
      if (!entry.via || !Array.isArray(entry.via)) {
        return false;
      }

      const originalVulnerabilities = entry.via.filter(viaEntry => 
        typeof viaEntry === 'object' && 
        viaEntry !== null &&
        viaEntry.url &&
        !URL_LIST.includes(viaEntry.url)
      );
      return originalVulnerabilities.length > 0;
    });

    if (validVulnerabilities.length > 0) {
      console.error(`Found ${validVulnerabilities.length} vulnerabilit${validVulnerabilities.length === 1 ? 'y' : 'ies'}:\n`);
      
      for (const [name, entry] of validVulnerabilities) {
        console.error(`  • ${name} (${entry.severity}) - ${entry.range}`);
      }
      
      console.error('\nRun `npm audit --omit dev` for more details.');
      process.exit(1);
    }

    console.log('✓ No vulnerabilities found');
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      console.error('Failed to parse npm audit output as JSON');
      console.error('Raw output:', error.message);
    } else {
      console.error('Audit check failed:', error.message);
    }
    process.exit(1);
  }
};

// You can manually run `npm audit --omit dev` to see the vulnerabilities in a human-friendly format
checkAudit().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});