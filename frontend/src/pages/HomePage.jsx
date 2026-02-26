import HealthStatus from "../components/HealthStatus.jsx";

function HomePage() {
  return (
    <main className="app-shell">
      <h1>App is running</h1>
      <HealthStatus />
    </main>
  );
}

export default HomePage;
