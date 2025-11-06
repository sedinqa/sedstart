import core from '@actions/core';
import fetch from 'node-fetch';

async function run() {
  try {
    const apiKey = core.getInput('apiKey');
    const projectId = core.getInput('projectId');
    const testId = core.getInput('testId');
    const profileId = core.getInput('profileId');
    const browser = core.getInput('browser');
    const headless = core.getInput('headless') === 'true';
    const env = core.getInput('environment');

    // Select Base URL
    const baseURL =
      env === 'QA'
        ? 'https://sedstart.sedinqa.com'
        : 'https://app.sedstart.com';

    const url = `${baseURL}/api/project/${projectId}/runCI`;

    const body = {
      test_id: Number(testId),
      profile_id: Number(profileId),
      browser,
      headless
    };

    console.log(`🚀 Triggering SedStart CI Run: ${url}`);
    console.log(`📡 Streaming events...\n`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    let finalStatus = null;

    const reader = response.body.getReader();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += Buffer.from(value).toString();
      const lines = buffer.split('\n');

      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          try {
            const eventData = JSON.parse(jsonStr);
            console.log(eventData);

            if (eventData?.result?.status) {
              finalStatus = eventData.result.status;
            }
          } catch (err) {
            console.log('Non JSON event:', line);
          }
        }
      }
    }

    console.log(`\n✅ Streaming finished. Final Status: ${finalStatus}`);

    if (finalStatus === 'PASS') {
      core.setOutput('result', 'PASS');
      return;
    } else {
      core.setFailed(`SedStart Test Failed: ${finalStatus}`);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
