import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health.js";

function HealthStatus() {
  const [statusText, setStatusText] = useState("Checking /api/health...");

  useEffect(() => {
    let active = true;

    fetchHealth()
      .then((data) => {
        if (active) {
          setStatusText(`Health API response: ${JSON.stringify(data)}`);
        }
      })
      .catch((error) => {
        if (active) {
          setStatusText(`Health API error: ${error.message}`);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return <p>{statusText}</p>;
}

export default HealthStatus;
