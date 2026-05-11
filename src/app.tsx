import { PropsWithChildren, useEffect } from "react";
import { I18nProvider } from "./i18n";
import { cancelActiveApiRequests } from "./services/api";
import { AuthProvider } from "./store/auth";
import "./app.scss";

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    return () => {
      cancelActiveApiRequests();
    };
  }, []);

  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
}

export default App;
