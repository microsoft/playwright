const { TestServer } = require("../../../../utils/testserver");
const headers = require('./azureHeaders');
const location = require('./azureLocationOptionsResponse.json');
const azureAreas = require('./azureAreas');
const azureTestOptionsResponse = require('./azureTestOptionsResponse.json');
const azureCoreOptionsResponse = require('./azureCoreOptionsResponse.json');

function setHeaders(response, headers) {
  const head = {};
  for (const [i, _] of headers.entries()) {
    if (i % 2 === 0) {
      head[headers[i]] = headers[i + 1];
    }
  }
  for (const [key, value] of Object.entries(head)) {
    response.setHeader(key, value);
  }
}

setTimeout(() => {
  TestServer.create(__dirname, process.argv[2] || 3000).then(server => {
    console.log('listening on port', server.PORT);
    server.setRoute('/_apis/Location', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(location));
    });

    server.setRoute('/_apis/ResourceAreas', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(azureAreas(server.PORT)));
    });

    server.setRoute('/_apis/Test', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(azureTestOptionsResponse));
    });

    server.setRoute('/_apis/core', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(azureCoreOptionsResponse));
    });

    server.setRoute('/_apis/projects/SampleSample', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(JSON.parse('{ "id": "40067afb-7d94-4832-8565-a31e3427ecd3","name": "SampleSample","url": "http://localhost:3000/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3","state": "wellFormed","revision": 11,"_links": { "self": { "href": "http://localhost:3000/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3" },"collection": { "href": "http://localhost:3000/_apis/projectCollections/71c15d06-b625-4e94-b256-84099a3c58d1" },"web": { "href": "http://localhost:3000/SampleSample" } },"visibility": "private","defaultTeam": { "id": "24a24c07-d755-4b33-bfaf-4b16ecf0fd85","name": "SampleSample Team","url": "http://localhost:3000/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3/teams/24a24c07-d755-4b33-bfaf-4b16ecf0fd85" },"lastUpdateTime": "2022-02-08T22:21:09.643Z" }')));
    });

    server.setRoute('/SampleSample/_apis/test/Runs', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(JSON.parse('{ "id": 150,"name": " Playwright Test Run","url": "http://localhost:3000/SampleSample/_apis/test/Runs/150","isAutomated": true,"owner": { "displayName": null,"id": "00000000-0000-0000-0000-000000000000" },"project": { "id": "40067afb-7d94-4832-8565-a31e3427ecd3","name": "SampleSample" },"state": "Unspecified","plan": { "id": "4" },"totalTests": 0,"incompleteTests": 0,"notApplicableTests": 0,"passedTests": 0,"unanalyzedTests": 0,"revision": 2,"webAccessUrl": "http://localhost:3000/SampleSample/_TestManagement/Runs?runId=150&_a=runCharts" }')));
    });

    server.setRoute('/SampleSample/_apis/test/Points', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(JSON.parse('{ "points": [{ "id": 1,"url": "http://localhost:3000/SampleSample/_apis/test/Plans/4/Suites/6/Points/1","assignedTo": { "displayName": "Alex Neo","id": "230e55b4-9e71-6a10-a0fa-777777777" },"automated": false,"configuration": { "id": "1","name": "Windows 10" },"lastTestRun": { "id": "238" },"lastResult": { "id": "100000" },"outcome": "Passed","state": "Completed","lastResultState": "Completed","suite": { "id": "6" },"testCase": { "id": "3" },"testPlan": { "id": "4" },"workItemProperties": [{ "workItem": { "key": "Microsoft.VSTS.TCM.AutomationStatus","value": "Not Automated" } }] }],"pointsFilter": { "testcaseIds": [3] } }')));
    });

    server.setRoute('/SampleSample/_apis/test/Runs/150', (message, response) => {
      setHeaders(response, headers);
      response.end(JSON.stringify(JSON.parse('{"id": 150,"name": " Playwright Test Run","url": "http://localhost:3000/SampleSample/_apis/test/Runs/150","isAutomated": true,"owner": {"displayName": "Alex Neo","id": "230e55b4-9e71-6a10-a0fa-780a87894418"},"project": {"id": "40067afb-7d94-4832-8565-a31e3427ecd3","name": "SampleSample"},"startedDate": "2022-07-02T14:59:47.523Z","completedDate": "2022-07-02T15:10:07.313Z","state": "Completed","plan": {"id": "4"},"totalTests": 0,"incompleteTests": 0,"notApplicableTests": 0,"passedTests": 0,"unanalyzedTests": 0,"revision": 4,"webAccessUrl": "http://localhost:3000/SampleSample/_TestManagement/Runs?runId=150&_a=runCharts"}')));
    });

  })

}, process.argv[3] ? +process.argv[3] : 0);