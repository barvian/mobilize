let prefs = {
  handled: [],
  ua: `Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14A403 Safari/602.1`
}, items, itemsHandlers = [] // handlers waiting for items

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(prefs) // Populate defaults
})

// Bootstrap
chrome.management.getAll(all => {
  items = all.filter(item => item.type === 'hosted_app' && item.enabled)
  while (itemsHandlers.length > 0) itemsHandlers.shift().call()
  
  chrome.management.onInstalled.addListener(onAppAdded)
  chrome.management.onUninstalled.addListener(onAppRemoved)
  chrome.management.onEnabled.addListener(onAppAdded)
  chrome.management.onDisabled.addListener(onAppRemoved)
  
  // Load prefs from storage and update listeners
  chrome.storage.sync.get(Object.keys(prefs), ps => {
    Object.assign(prefs, ps)
    if (prefs.handled.length > 0) updateListeners()
  })
})

function handleApp(id) {
  if (prefs.handled.includes(id)) return
  
  prefs.handled.push(id)
  chrome.storage.sync.set({ handled: prefs.handled })
  updateListeners()
}

function unhandleApp(id) {
  if (!prefs.handled.includes(id)) return
  
  prefs.handled = prefs.handled.filter(_id => _id != id)
  chrome.storage.sync.set({ handled: prefs.handled })
  updateListeners()
}

function onAppAdded(item) {
  if (
    item.type !== 'hosted_app' || !item.enabled ||
    items.find(i => i.id == item.id)
  ) return
  items.unshift(item)
  chrome.runtime.sendMessage({type: 'ADD_APP', item})
}

function onAppRemoved(item) {
  const id = item.id == null ? item : item.id // management.onUninstalled just gives id
  const i = items.findIndex(it => it.id == id)
  if (i === -1) return
  items.splice(i, 1)
  chrome.runtime.sendMessage({type: 'REMOVE_APP', id})
  unhandleApp(id)
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_APPS') {
    if (items) sendResponse(items)
    else itemsHandlers.push(sendResponse.bind(null, items))
  } else if (message.type === 'GET_HANDLED') { // no race condition here
    sendResponse(prefs.handled)
  } else if (message.type === 'HANDLE_APP') {
    handleApp(message.id)
  } else if (message.type === 'UNHANDLE_APP') {
    unhandleApp(message.id)
  }
})

function updateListeners() {
  const urls = items
    .filter(item => prefs.handled.includes(item.id))
    .map(item => {
      const url = new URL(item.appLaunchUrl), parts = url.hostname.split('.').reverse()
      if (
        parts[0] == 'com' && parts[1] == 'google' &&
        url.pathname.startsWith('/maps')
      ) {
        return `*://${url.hostname}/maps*`
      }
      
      return `*://${url.hostname}/*`
    })
  chrome.webRequest.onBeforeSendHeaders.removeListener(headersListener)
  if (urls.length <= 0) return
  console.log(urls)
  chrome.webRequest.onBeforeSendHeaders.addListener(headersListener, {
    urls
  }, ['blocking', 'requestHeaders'])
}

function headersListener(details) {
  const uaIndex = details.requestHeaders.findIndex(h => h.name.toLowerCase() === 'user-agent')
  if (uaIndex === -1) return // TODO: maybe add it?
  details.requestHeaders[uaIndex].value = prefs.ua

  return { requestHeaders: details.requestHeaders }
}