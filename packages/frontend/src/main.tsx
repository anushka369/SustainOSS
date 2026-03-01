/**
 * SustainOSS - Open Source Sustainability Analytics Platform
 * Copyright (c) 2024 SustainOSS Contributors
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts';
import { MainLayout, ProtectedRoute } from './components';
import { RepositoryList, Dashboard, GoodFirstIssues, Login, MaintainerDetails } from './pages';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RepositoryList />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="good-first-issues" element={<GoodFirstIssues />} />
            <Route path="maintainer" element={<MaintainerDetails />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
