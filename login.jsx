import { useState } from "react";
import { auth, db } from "../utils/firebase";
import { signInWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { collection, doc, getDocs, query, where } from "firebase/firestore";


export default function Login() {
  const [formData, setFormData] = useState({ rollNumber: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
 
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });//the value targeted by event will only change rest all same as pvs;
  };

  // Email/Password Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        `${formData.rollNumber}@dummy.com`,
        formData.password
      );
      alert("Login successful!");
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // OTP Login - Send Code
  const sendOtp = async () => {  
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container", //earlier we did recap,size,auth ; but correct flow for firebase v9 is auth,recap,size;
          { size: "invisible" },
        );

        window.recaptchaVerifier.render().then((widgetId) => {
          window.recaptchaWidgetId = widgetId;
        });
      }

      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setOtpSent(true);
      setMessage(`OTP sent to ${phone}`);
    } catch (err) {
      console.log(err);
      setError("Error sending OTP: " + err.message);
    }
    setLoading(false);
  };

  // OTP Login - Verify Code
const verifyOtp = async () => {
  setError("");
  setLoading(true);
  try {
    const result = await window.confirmationResult.confirm(otp);
    const user = result.user;
    let phoneNumber = user.phoneNumber;

    
    if (phoneNumber.startsWith("+91")) {
      phoneNumber = phoneNumber.substring(3);
    }

    console.log("✅ Normalized phoneNumber:", phoneNumber);

  
    const q = query(collection(db, "users"), where("mobile", "==", phoneNumber));
    const querySnapshot = await getDocs(q);

    console.log("📄 Query result empty:", querySnapshot.empty);

    if (!querySnapshot.empty) {
      console.log("🎯 Existing Firestore user found!");
      setMessage("✅ Welcome back!");
      alert("✅ Login successful!");
      navigate("/");
    } else {
      console.log("🚫 No Firestore user found for this phone number.");
      setMessage("⚠️ New user detected. Please sign up.");
      navigate("/signup", { state: { phoneNumber } });
    }
  } catch (err) {
    console.error("❌ OTP Verification Error:", err);
    setError("❌ Invalid OTP. Try again.");
  }
  setLoading(false);
};



  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefefe] p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-4">Login</h2>

        {/* Email/Password Login */}
        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <input
            id="rollNumber"
            name="rollNumber"
            className="w-full border border-gray-300 rounded-lg p-3"
            placeholder="Roll Number"
            value={formData.rollNumber}
            onChange={handleChange}
            required
          />
          <div className="relative">
            <input
              id="password"
              name="password"
              className="w-full border border-gray-300 rounded-lg p-3 pr-12"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f7c346] hover:bg-[#f5b900] text-white font-semibold py-3 rounded-lg shadow-md"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* OTP Login */}
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Or Login with OTP</h3>

          {!otpSent ? (
            <>
              <input
                id="phone"
                name="phone"
                className="w-full border border-gray-300 rounded-lg p-3 mb-3"
                type="tel"
                placeholder="Mobile Number (+91XXXXXXXXXX)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div id="recaptcha-container"></div>
              <button
                onClick={sendOtp}
                disabled={loading || !phone}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg shadow-md"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <input
                id="otp"
                name="otp"
                className="w-full border border-gray-300 rounded-lg p-3 mb-3"
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button
                onClick={verifyOtp}
                disabled={loading || !otp}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg shadow-md"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </>
          )}
        </div>

        {message && <p className="text-green-600 mt-3">{message}</p>}

        <p className="text-sm text-gray-600 mt-4">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-green-600 hover:underline">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}

