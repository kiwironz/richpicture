import CanvasEngine from './components/CanvasEngine/CanvasEngine'
import ToolPalette from './components/ToolPalette/ToolPalette'
import { VisualStoreProvider } from './store/VisualStoreContext'

function App() {
  return (
    <VisualStoreProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
        <ToolPalette />
        <CanvasEngine />
      </div>
    </VisualStoreProvider>
  )
}

export default App
