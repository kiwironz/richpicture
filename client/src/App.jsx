import CanvasEngine from './components/CanvasEngine/CanvasEngine'
import ToolPalette from './components/ToolPalette/ToolPalette'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
      <ToolPalette />
      <CanvasEngine />
    </div>
  )
}

export default App
