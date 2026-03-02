import { useState } from 'react'
import CanvasEngine from './components/CanvasEngine/CanvasEngine'
import ToolPalette from './components/ToolPalette/ToolPalette'
import IconLibrary from './components/IconLibrary/IconLibrary'
import { VisualStoreProvider } from './store/VisualStoreContext'
import DevSeeder from './dev/DevSeeder'

function App() {
  const [activeTool,       setActiveTool]       = useState('freehand')
  const [pendingIcon,      setPendingIcon]      = useState(null)
  const [pendingImageFile, setPendingImageFile] = useState(null)

  // User clicked an icon in the library → enter place mode
  function handleIconPlace(iconDef) {
    setPendingIcon(iconDef)
    setActiveTool('place-icon')   // canvas waits for a click to set exact position
  }

  // After the icon lands on canvas (or ESC to cancel)
  function handleIconPlaced() {
    setPendingIcon(null)
    setActiveTool('select')
  }

  return (
    <VisualStoreProvider>
      {import.meta.env.DEV && <DevSeeder />}
      <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
        <ToolPalette
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onImagePicked={file => setPendingImageFile(file)}
        />
        {(activeTool === 'icons' || activeTool === 'place-icon') && (
          <IconLibrary onPlace={handleIconPlace} />
        )}
        <CanvasEngine
          activeTool={activeTool}
          pendingIcon={pendingIcon}
          onIconPlaced={handleIconPlaced}
          pendingImageFile={pendingImageFile}
          onImagePlaced={() => setPendingImageFile(null)}
        />
      </div>
    </VisualStoreProvider>
  )
}

export default App
