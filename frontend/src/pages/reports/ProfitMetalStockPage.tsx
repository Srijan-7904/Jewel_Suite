// frontend/src/pages/reports/ProfitMetalStockPage.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';

export const ProfitMetalStockPage: React.FC = () => {
  return <Navigate to="/inventory/metal-inward" replace />;
};
