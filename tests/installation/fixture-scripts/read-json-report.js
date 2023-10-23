const report = require(process.argv[2]);
if (report.suites[0].specs[0].title !== 'sample test') {
  console.log(`Wrong spec title`);
  process.exit(1);
}

const projects = report.suites[0].specs[0].tests.map(t => t.projectName).sort();
if (process.argv.slice(3).includes('--validate-chromium-project-only')) {
  if (projects.length !== 1 || projects[0] !== 'chromium') {
    console.log(`Wrong browsers`);
    process.exit(1);
  }
} else {
  if (projects.length !== 3 || projects[0] !== 'chromium' || projects[1] !== 'firefox' || projects[2] !== 'webkit') {
    console.log(`Wrong browsers`);
    process.exit(1);
  }
}

for (const test of report.suites[0].specs[0].tests) {
  if (test.results[0].status !== 'passed') {
    console.log(`Test did not pass`);
    process.exit(1);
  }
}
console.log('Report check SUCCESS');
process.exit(0);
