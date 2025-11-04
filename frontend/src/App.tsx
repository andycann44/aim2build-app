import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import LegoHeader from "./components/LegoHeader";
import Home from "./pages/Home";
import SetsSearch from "./pages/SetsSearch";
import MySets from "./pages/MySets";
import Inventory from "./pages/Inventory";
import Buildability from "./pages/Buildability";

export default function App(){
  return (
    <BrowserRouter>
      <LegoHeader />
      <nav style={{background:"#111827", color:"#fff", padding:"8px 16px", display:"flex", gap:12}}>
        <Link style={{color:"#fff"}} to="/">Home</Link>
        <Link style={{color:"#fff"}} to="/search">Search</Link>
        <Link style={{color:"#fff"}} to="/my-sets">My Sets</Link>
        <Link style={{color:"#fff"}} to="/inventory">Inventory</Link>
        <Link style={{color:"#fff"}} to="/buildability">Buildability</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/search" element={<SetsSearch/>}/>
        <Route path="/my-sets" element={<MySets/>}/>
        <Route path="/inventory" element={<Inventory/>}/>
        <Route path="/buildability" element={<Buildability/>}/>
        {/* old alias */}
        <Route path="/owned" element={<Navigate to="/my-sets" replace />} />
      </Routes>
    </BrowserRouter>
  );
}