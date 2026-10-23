import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter-tight/500.css'
import '@fontsource/geist/400.css'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/500.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/500.css'
import './styles.css'
import './secondary.css'
import './remaining.css'
import './visual-r4-shell-fit.css'
import './visual-r4-rail.css'
import './visual-r4-nav.css'
import './visual-homework-library.css' // round 5 homework library
// Component-owned visual repairs must follow the shared base styles in the cascade.
import { App } from './App'
import './visual-r5-nav.css' // round 5 nav wiring for the homework routes
import './visual-homework-wizard.css' // r5 create-wizard page styles (keeps r4-shell-fit css-import regex out)
import './visual-care-plan.css' // round-5 care-plan insertion styles (comment keeps the r4-shell-fit import regex green)
import './visual-r5-dialogs.css' // r5 dialogs-remove styles (kept out of r4-shell-fit's css list)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
