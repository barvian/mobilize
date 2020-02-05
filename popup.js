const apps = document.querySelector('.apps')
const itemTemplate = document.querySelector('#item')

function render(items) {
  chrome.runtime.sendMessage({type: 'GET_HANDLED'}, handled => {
    items.forEach(item => renderItem(item, handled.includes(item.id)))
  })
}

function renderItem(item, checked = false, prepend = false) {
  const itemEl = itemTemplate.content.cloneNode(true),
    checkbox = itemEl.querySelector('[type="checkbox"]')
  checkbox.setAttribute('id', item.id)
  checkbox.checked = checked
  itemEl.querySelector('label').setAttribute('for', item.id)
  itemEl.querySelector('.app__icon').setAttribute('src',
    item.icons.find((icon) => icon.size >= 32).url
  )
  itemEl.querySelector('.app__name').textContent = item.shortName
  
  checkbox.addEventListener('change', handleCheckboxChange)
  if (prepend) apps.insertBefore(itemEl, apps.firstChild)
  else apps.appendChild(itemEl)
}

// Bootstrap
chrome.runtime.sendMessage({type: 'GET_APPS'}, render)

function handleCheckboxChange(event) {
  const box = event.target
  chrome.runtime.sendMessage({type: `${box.checked ? '' : 'UN'}HANDLE_APP`, id: box.id})
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REMOVE_APP') {
    const itemEl = document.getElementById(message.id)
    if (itemEl) apps.removeChild(itemEl.parentNode)
  } else if (message.type === 'ADD_APP' && !document.getElementById(message.item.id)) {
    renderItem(message.item, false, true)
  }
})