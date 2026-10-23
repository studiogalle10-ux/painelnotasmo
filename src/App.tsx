import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorSessao } from './componentes/ProvedorSessao';
import { RotaProtegida } from './componentes/RotaProtegida';
import { Login } from './paginas/Login';

// Cada tela é baixada só quando usada.
const Bipar = lazy(() => import('./paginas/Bipar').then((m) => ({ default: m.Bipar })));
const Tv = lazy(() => import('./paginas/Tv').then((m) => ({ default: m.Tv })));

const carregando = <p className="aviso">Carregando…</p>;

export default function App() {
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Suspense fallback={carregando}>
          <Routes>
            <Route path="/" element={<Navigate to="/bipar" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/bipar" element={<RotaProtegida><Bipar /></RotaProtegida>} />
            <Route path="/tv" element={<RotaProtegida><Tv /></RotaProtegida>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ProvedorSessao>
  );
}
