import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Charts from './pages/Charts';
import Meals from './pages/Meals';
import Devices from './pages/Devices';
import Communities from './pages/Communities';
import Profile from './pages/Profile';
import Login from './pages/Login';
import MealTrajectory from './pages/MealTrajectory';
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
        <Route path="meals" element={<RequireAuth><Meals /></RequireAuth>} />
        <Route path="meals/:mealId/trajectory" element={<RequireAuth><MealTrajectory /></RequireAuth>} />
        <Route path="trajectory" element={<RequireAuth><MealTrajectory /></RequireAuth>} />
        <Route path="devices" element={<RequireAuth><Devices /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="communities" element={<RequireAuth><Communities /></RequireAuth>} />
      </Route>
    </Routes>
  );
}
