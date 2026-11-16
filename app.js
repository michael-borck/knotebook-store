const PLAYER_URL = 'https://knotebook.borck.education/app/'
const CATALOGUE_URL = new URL('catalogue.json', location.href).toString()

const state = { catalogue: null, theme: '' }

const playerLink = new URL(PLAYER_URL)
playerLink.searchParams.set('player', '1')
playerLink.searchParams.set('view', 'store')
playerLink.searchParams.set('store', CATALOGUE_URL)

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function label(theme) {
  return theme.charAt(0).toUpperCase() + theme.slice(1)
}

function themes() {
  return [...new Set(state.catalogue.packs.map((pack) => pack.theme))].sort(
    (a, b) => label(a).localeCompare(label(b)),
  )
}

function renderFilters() {
  const container = document.getElementById('filters')
  container.replaceChildren()
  const options = themes()
  if (options.length < 2) return

  const all = el('button', state.theme === '' ? 'active' : '', 'All')
  all.type = 'button'
  all.addEventListener('click', () => {
    state.theme = ''
    render()
  })
  container.appendChild(all)

  for (const theme of options) {
    const button = el(
      'button',
      state.theme === theme ? 'active' : '',
      label(theme),
    )
    button.type = 'button'
    button.addEventListener('click', () => {
      state.theme = state.theme === theme ? '' : theme
      render()
    })
    container.appendChild(button)
  }
}

function render() {
  if (!state.catalogue) return
  renderFilters()

  const list = document.getElementById('packs')
  list.replaceChildren()
  const packs = state.catalogue.packs.filter(
    (pack) => !state.theme || pack.theme === state.theme,
  )

  for (const pack of packs) {
    const item = el('li', 'card')
    item.appendChild(
      el(
        'div',
        'theme',
        pack.theme + (pack.release ? ' · v' + pack.release : ''),
      ),
    )
    item.appendChild(el('h2', null, pack.title))
    item.appendChild(el('p', 'muted', pack.author || 'Unknown author'))
    if (pack.description) item.appendChild(el('p', 'desc', pack.description))
    const link = el('a', 'button', 'Install in Player')
    link.href = playerLink.toString()
    item.appendChild(link)
    list.appendChild(item)
  }

  if (packs.length === 0) {
    list.appendChild(el('li', 'muted', 'No packs match this theme.'))
  }

  const signed = state.catalogue.publicKey ? 'signed' : 'unsigned'
  document.getElementById('status').textContent =
    packs.length +
    ' of ' +
    state.catalogue.packs.length +
    ' pack(s) · ' +
    signed +
    ' catalogue'
}

fetch(CATALOGUE_URL)
  .then((response) => {
    if (!response.ok) throw new Error('catalogue ' + response.status)
    return response.json()
  })
  .then((catalogue) => {
    state.catalogue = catalogue
    render()
  })
  .catch((error) => {
    document.getElementById('status').textContent =
      'Could not load the catalogue: ' + error.message
  })