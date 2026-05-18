import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MobileNav } from "@/components/MobileNav";
import Dashboard from "./pages/Dashboard";
import ProductsPage from "./pages/ProductsPage";
import ProductionPage from "./pages/ProductionPage";
import DistributionPage from "./pages/DistributionPage";
import ReportsPage from "./pages/ReportsPage";
import { CanteenPage } from "./pages/CanteenPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/distribution" element={<DistributionPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/canteen" element={<CanteenPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <MobileNav />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
