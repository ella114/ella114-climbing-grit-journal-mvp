import { PropsWithChildren, useEffect } from "react";
import { cancelActiveApiRequests } from "./services/api";
import { AuthProvider } from "./store/auth";
import "./app.scss";

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    return () => {
      cancelActiveApiRequests();
    };
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}

export default App;
