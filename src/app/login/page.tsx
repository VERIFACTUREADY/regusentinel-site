import { LoginForm } from "./login-form";

export default function LoginPage() {
  const demoEnabled = process.env.DEMO_ENABLED === "true";
  return <LoginForm demoEnabled={demoEnabled} />;
}
