import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { migrateOldStorage } from './stores/migrate.js'
import { consumeHashSecret } from './services/syncClient.js'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/tokens.css'
import './styles/style.css'

migrateOldStorage()
// Vor dem Render: der Kopplungslink soll nicht erst nach dem Mount greifen,
// und der Schluessel darf nicht in der Adresszeile stehen bleiben.
consumeHashSecret()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
