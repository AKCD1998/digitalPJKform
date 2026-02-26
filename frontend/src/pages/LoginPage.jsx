import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider.jsx";

function getErrorMessage(error) {
  return (
    error?.response?.data?.error ||
    error?.message ||
    "Login failed. Please try again."
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithCredentials, isAuthenticated, isBootstrapping } = useAuth();

  const [username, setUsername] = useState("admin000");
  const [password, setPassword] = useState("Admin@123");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromPath = location.state?.from || "/form";

  useEffect(() => {
    if (!isBootstrapping && isAuthenticated) {
      navigate(fromPath, { replace: true });
    }
  }, [fromPath, isAuthenticated, isBootstrapping, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await loginWithCredentials(username.trim(), password);
      navigate(fromPath, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell auth-shell">
      <h1>Login</h1>
      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default LoginPage;
