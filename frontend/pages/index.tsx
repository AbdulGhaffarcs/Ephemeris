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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0B1220" />
      </Head>
      <Dashboard />
    </>
  );
}
