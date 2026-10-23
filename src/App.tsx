import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorSessao } from './componentes/ProvedorSessao';
import { RotaProtegida } from './componentes/RotaProtegida';
import { PAPEIS_POR_ROTA, rotaInicial, useSessao } from './lib/sessao';
import { Login } from './paginas/Login';

// Cada tela é baixada só quando usada: a TV não carrega o código do admin nem da câmera.
const Bipar = lazy(() => import('./paginas/Bipar').then((m) => ({ default: m.Bipar })));
const Tv = lazy(() => import('./paginas/Tv').then((m) => ({ default: m.Tv })));
const Admin = lazy(() => import('./paginas/Admin').then((m) => ({ default: m.Admin })));

const carregando = <p className="aviso">Carregando…</p>;

function Inicio() {
  const { carregando: carregandoSessao, papel } = useSessao();
  if (carregandoSessao) return carregando;
  return <Navigate to={rotaInicial(papel)} replace />;
}

export default function App() {
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Suspense fallback={carregando}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/login" element={<Login />} />
            <Route path="/bipar" element={
              <RotaProtegida papeis={PAPEIS_POR_ROTA['/bipar']}><Bipar /></RotaProtegida>
            } />
            <Route path="/tv" element={
              <RotaProtegida papeis={PAPEIS_POR_ROTA['/tv']}><Tv /></RotaProtegida>
            } />
            <Route path="/admin" element={
              <RotaProtegida papeis={PAPEIS_POR_ROTA['/admin']}><Admin /></RotaProtegida>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ProvedorSessao>
  );
}
