import { useState } from 'react'
import CanvasEngine from './components/CanvasEngine/CanvasEngine'
import ToolPalette from './components/ToolPalette/ToolPalette'
import { VisualStoreProvider } from './store/VisualStoreContext'
import DevSeeder from './dev/DevSeeder'

function App() {
  const [activeTool, setActiveTool] = useState('freehand')

  return (
    <VisualStoreProvider>
      {import.meta.env.DEV && <DevSeeder />}
      <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
        <ToolPalette activeTool={activeTool} onToolChange={setActiveTool} />
        <CanvasEngine activeTool={activeTool} />
      </div>
    </VisualStoreProvider>
  )
}

export default App
