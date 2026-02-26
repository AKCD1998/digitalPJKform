import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import FormPage from "./pages/FormPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/form" element={<FormPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/form" replace />} />
          <Route path="*" element={<Navigate to="/form" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
