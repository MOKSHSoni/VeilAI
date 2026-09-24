import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Scan } from './screens/Scan';
import { DocumentScan } from './screens/DocumentScan';
import { Dashboard } from './screens/Dashboard';
import { Feedback } from './screens/Feedback';
import { Benchmark } from './screens/Benchmark';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Scan />} />
          <Route path="document" element={<DocumentScan />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="benchmark" element={<Benchmark />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
