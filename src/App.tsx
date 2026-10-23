import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorSessao } from './componentes/ProvedorSessao';
import { RotaProtegida } from './componentes/RotaProtegida';
import { rotaInicial, useSessao } from './lib/sessao';
import { Admin } from './paginas/Admin';
import { Bipar } from './paginas/Bipar';
import { Login } from './paginas/Login';
import { Tv } from './paginas/Tv';

function Inicio() {
  const { carregando, papel } = useSessao();
  if (carregando) return <p className="aviso">Carregando…</p>;
  return <Navigate to={rotaInicial(papel)} replace />;
}

export default function App() {
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bipar" element={
            <RotaProtegida papeis={['operador', 'admin']}><Bipar /></RotaProtegida>
          } />
          <Route path="/tv" element={
            <RotaProtegida papeis={['tv', 'admin']}><Tv /></RotaProtegida>
          } />
          <Route path="/admin" element={
            <RotaProtegida papeis={['admin']}><Admin /></RotaProtegida>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  );
}
