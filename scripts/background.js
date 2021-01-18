
chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    "id": "edit",
    "title": "编辑书签",
    "contexts": ["page"]
  })
})