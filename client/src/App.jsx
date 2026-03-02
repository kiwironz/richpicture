import { useState } from 'react'
import CanvasEngine from './components/CanvasEngine/CanvasEngine'
import ToolPalette from './components/ToolPalette/ToolPalette'
import IconLibrary from './components/IconLibrary/IconLibrary'
import { VisualStoreProvider } from './store/VisualStoreContext'
import DevSeeder from './dev/DevSeeder'

function App() {
  const [activeTool,  setActiveTool]  = useState('freehand')
  const [pendingIcon, setPendingIcon] = useState(null)

  function handleIconPlace(iconDef) {
    setPendingIcon(iconDef)
    setActiveTool('select')  // switch to select so user can drag it immediately
  }

  return (
    <VisualStoreProvider>
      {import.meta.env.DEV && <DevSeeder />}
      <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
        <ToolPalette activeTool={activeTool} onToolChange={setActiveTool} />
        {activeTool === 'icons' && (
          <IconLibrary onPlace={handleIconPlace} />
        )}
        <CanvasEngine
          activeTool={activeTool}
          pendingIcon={pendingIcon}
          onIconPlaced={() => setPendingIcon(null)}
        />
      </div>
    </VisualStoreProvider>
  )
}

export default App
