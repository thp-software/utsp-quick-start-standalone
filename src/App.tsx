/**
 * Main Application Entry Point
 *
 * This file demonstrates the minimal setup to run a UTSP application.
 * To create your own game:
 * 1. Create a new file in src/applications/ implementing IApplication
 * 2. Import it here and pass it to UTSPClient
 */

import './App.css'
import { UTSPClient } from './components/utsp-client'
import { SpaceDemo } from './applications/SpaceDemo'

function App() {
  return (
    <div className="app">
      <UTSPClient
        application={new SpaceDemo()}
        width={60}
        height={20}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default App
