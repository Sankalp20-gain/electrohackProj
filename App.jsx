import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./components/Signup";
import Login from "./components/login";      
import Dashboard from "./components/Dashboard";  
import Home from "./components/home";
import HostelDashboard from "./components/HostelDashboard";
import { AuthProvider } from "./Auth/AuthContext";
import OrderDetails from "./components/OrderDetails";
import ProtectedRoute from "./Auth/ProtectedRoute";
import Profile from "./components/Profile";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />

          <Route
            path="/dashboard/:hostelId"
            element={
              <ProtectedRoute>
                <HostelDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:hostelId/order/:orderId"
            element={<OrderDetails />}
          />
        </Routes>
      </Router>
     </AuthProvider>
  );
}
