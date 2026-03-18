import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Charts from './pages/Charts';
import Report from './pages/Report';
import Recommendations from './pages/Recommendations';
import Meals from './pages/Meals';
import Devices from './pages/Devices';
import Community from './pages/Community';
import Login from './pages/Login';
import { getToken } from './api/client';
import './App.css';

function RequireAuth({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="charts" element={<RequireAuth><Charts /></RequireAuth>} />
        <Route path="report" element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="recommendations" element={<RequireAuth><Recommendations /></RequireAuth>} />
        <Route path="meals" element={<RequireAuth><Meals /></RequireAuth>} />
        <Route path="devices" element={<RequireAuth><Devices /></RequireAuth>} />
        <Route path="community" element={<RequireAuth><Community /></RequireAuth>} />
      </Route>
    </Routes>
  );
}
