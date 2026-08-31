import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ComparisonProvider } from './context/ComparisonContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

// Side-effect import: this is what actually calls i18n.init(). Nothing
// imported it before, so every useTranslation() call in the app was running
// against an uninitialised i18next instance.
import './i18n.js';

import './index.css';

/*
 * Provider order matters here.
 *
 * WishlistProvider reads AuthContext to decide whether to load the wishlist
 * from the API or from localStorage, so it has to sit inside AuthProvider.
 * CartProvider is independent of both — it only touches localStorage — but it
 * has to be above the router, because Navbar and CartDrawer both consume it
 * and they are rendered by the App layout on every route.
 *
 * ThemeProvider is outermost. It depends on nothing, and it writes
 * data-theme in a layout effect, so mounting it first means the attribute is
 * on <html> before anything below it paints.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <ComparisonProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ComparisonProvider>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
