import { Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Charts from './pages/Charts';
import Report from './pages/Report';
import Recommendations from './pages/Recommendations';
import Devices from './pages/Devices';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="charts" element={<Charts />} />
        <Route path="report" element={<Report />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="devices" element={<Devices />} />
      </Route>
    </Routes>
  );
}
