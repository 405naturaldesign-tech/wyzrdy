import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from '@/lib/auth';
import { ConsentProvider } from '@/lib/consent';
import ConsentBanner from '@/components/ConsentBanner';
import HomePage from './pages/HomePage';
import EasyBreezy from './pages/EasyBreezy';
import ForgeSEO from './pages/ForgeSEO';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import BlueprintSection from './pages/BlueprintSection';
import Monitor from './pages/Monitor';
import Pricing from './pages/Pricing';
import Performance from './pages/Performance';
import Checkout from './pages/Checkout';
import FoundingCheckout from './pages/FoundingCheckout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import ArtifactVault from './pages/ArtifactVault';
import LegalPage from './pages/LegalPage';
import DataRequest from './pages/DataRequest';
import Contact from './pages/Contact';
import Checklist from './pages/Checklist';
import NotFound from './pages/NotFound';
import { PRIVACY, TERMS, COOKIES, SECURITY, ACCESSIBILITY, DPA } from '@/lib/legalContent';

function App() {
    return (
        <ErrorBoundary>
        <AuthProvider>
            <ConsentProvider>
                <Router>
                    <ScrollToTop />
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/easy-breezy" element={<EasyBreezy />} />
                        <Route path="/forgeseo" element={<ForgeSEO />} />
                        <Route path="/login" element={<AuthPage />} />
                        <Route path="/signup" element={<AuthPage />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/blueprint/:slug" element={<BlueprintSection />} />
                        <Route path="/monitor" element={<Monitor />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/performance" element={<Performance />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/checkout/founding" element={<FoundingCheckout />} />
                        <Route path="/checkout/success" element={<CheckoutSuccess />} />
                        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
                        <Route path="/artifacts" element={<ArtifactVault />} />
                        <Route path="/privacy" element={<LegalPage page={PRIVACY} />} />
                        <Route path="/terms" element={<LegalPage page={TERMS} />} />
                        <Route path="/cookies" element={<LegalPage page={COOKIES} />} />
                        <Route path="/security" element={<LegalPage page={SECURITY} />} />
                        <Route path="/accessibility" element={<LegalPage page={ACCESSIBILITY} />} />
                        <Route path="/dpa" element={<LegalPage page={DPA} />} />
                        <Route path="/data-request" element={<DataRequest />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/admin/checklist" element={<Checklist />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                    <ConsentBanner />
                </Router>
            </ConsentProvider>
        </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
