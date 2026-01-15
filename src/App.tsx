import { useEffect, useState } from "react";
import { useAppStore } from "./stores/appStore";
import StartScreen from "./components/StartScreen";
import MainLayout from "./components/MainLayout";

function App() {
  const { currentProject, initialized, initialize } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initialize();
      setLoading(false);
    };
    init();
  }, [initialize]);

  if (loading || !initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-dark-bg">
        <div className="text-dark-text-muted">Laden...</div>
      </div>
    );
  }

  if (!currentProject) {
    return <StartScreen />;
  }

  return <MainLayout />;
}

export default App;
