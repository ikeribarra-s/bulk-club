import { createBrowserRouter, redirect } from "react-router";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Clientes from "./pages/Clientes";
import Ventas from "./pages/Ventas";
import Proveedores from "./pages/Proveedores";
import Compras from "./pages/Compras";
import Permutas from "./pages/Permutas";
import Historial from "./pages/Historial";
import Catalogo from "./pages/Catalogo";

function authLoader() {
  if (!localStorage.getItem('loggedIn')) {
    return redirect('/login');
  }
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/catalogo",
    Component: Catalogo,
  },
  {
    path: "/",
    Component: Layout,
    loader: authLoader,
    children: [
      { index: true, Component: Dashboard },
      { path: "inventario", Component: Inventario },
      { path: "clientes", Component: Clientes },
      { path: "ventas", Component: Ventas },
      { path: "proveedores", Component: Proveedores },
      { path: "compras", Component: Compras },
      { path: "permutas", Component: Permutas },
      { path: "historial", Component: Historial },
    ],
  },
]);
