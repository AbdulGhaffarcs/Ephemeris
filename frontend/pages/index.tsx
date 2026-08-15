import Head from "next/head";
import Dashboard from "../components/Dashboard";

export default function Home() {
  return (
    <>
      <Head>
        <title>Ephemeris — spacecraft telemetry monitor</title>
        <meta
          name="description"
          content="Physics-grounded digital-twin anomaly detection for spacecraft telemetry"
        />
      </Head>
      <Dashboard />
    </>
  );
}
