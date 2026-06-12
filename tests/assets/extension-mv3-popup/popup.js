document.getElementById('uppercase').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.body.innerText = document.body.innerText.toUpperCase();
    },
  });
});
