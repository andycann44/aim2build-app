import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LegoHeader from "./components/LegoHeader";
import Home from "./pages/Home";
import SetsSearch from "./pages/SetsSearch";
import OwnedSets from "./pages/OwnedSets";
import NewCreations from "./pages/NewCreations";
import Inventory from "./pages/Inventory";
import Buildability from "./pages/Buildability";

export default function App(){
  return (
    <BrowserRouter>
      <LegoHeader/>
      <nav style={{padding:"8px 16px", display:"flex", gap:12}}>
        <Link to="/">Home</Link>
        <Link to="/search">Search</Link>
        <Link to="/owned">Owned</Link>
        <Link to="/inventory">Inventory</Link>
        <Link to="/build">Buildability</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/search" element={<SetsSearch/>}/>
        <Route path="/owned" element={<OwnedSets/>}/>
        <Route path="/inventory" element={<Inventory/>}/>
        <Route path="/build" element={<Buildability/>}/>
      </Routes>
    </BrowserRouter>
  );
}
