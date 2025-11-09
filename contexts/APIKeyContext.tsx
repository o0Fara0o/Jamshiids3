/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createContext, FC, ReactNode, useContext } from 'react';

const APIKeyContext = createContext<string | undefined>(undefined);

export const APIKeyProvider: FC<{ apiKey: string; children: ReactNode }> = ({
  apiKey,
  children,
}) => {
  return (
    <APIKeyContext.Provider value={apiKey}>{children}</APIKeyContext.Provider>
  );
};

export const useAPIKey = () => {
  const context = useContext(APIKeyContext);
  if (!context) {
    throw new Error('useAPIKey must be used within an APIKeyProvider');
  }
  return context;
};
