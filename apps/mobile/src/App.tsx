import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './navigation/AppNavigator';
import { restoreSession } from './services/api';
import { LoadingState } from './components/LoadingState';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active && isAuthenticated === null) {
        setIsAuthenticated(false);
      }
    }, 2500);

    restoreSession()
      .then(() => {
        if (active) setIsAuthenticated(true);
      })
      .catch(() => {
        if (active) setIsAuthenticated(false);
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <SafeAreaProvider>
        <LoadingState message="Restaurando sesión segura…" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator
          isAuthenticated={isAuthenticated}
          onLoginSuccess={() => setIsAuthenticated(true)}
          onLogout={() => setIsAuthenticated(false)}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
