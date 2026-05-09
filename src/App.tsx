import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Callback from "./pages/Callback";
import LinkRequired from "./pages/LinkRequired";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/link-required" element={<LinkRequired />} />
        <Route path="/user/:username" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
