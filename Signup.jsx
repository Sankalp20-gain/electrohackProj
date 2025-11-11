import { useState } from "react";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate} from "react-router-dom";

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    rollNumber: "",
    hostel: "",
    roomNumber: "",
    mobile: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const navigate = useNavigate();

  
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return window.recaptchaVerifier;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const sendOTP = async () => {
    setError("");
    try {
      const verifier = setupRecaptcha();
      const phoneNumber = `+91${formData.mobile}`;
      const confirmation = await linkWithPhoneNumber(auth.currentUser, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      alert("OTP sent to your phone number!");
    } catch (err) {
      console.error(err);
      setError("Failed to send OTP. Try again.");
    }
  };

  const verifyOTP = async () => {
    try {
      await confirmationResult.confirm(otp);
      alert("Phone number verified successfully!");
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Invalid OTP. Please try again.");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
       
      const rollRef = doc(db, "rollNumbers", formData.rollNumber);
      const rollSnap = await getDoc(rollRef);
      if (rollSnap.exists()) {
        setError("Roll number already registered.");
        setLoading(false);
        return;
      }

      
      const userCred = await createUserWithEmailAndPassword(
        auth,
        `${formData.rollNumber}@dummy.com`,
        formData.password
      );
 
      await setDoc(doc(db, "users", userCred.user.uid), {
        ...formData,
        createdAt: new Date(),
      });

      
      await setDoc(doc(db, "rollNumbers", formData.rollNumber), {
        uid: userCred.user.uid,
      });

      alert("Signup successful! Now verifying your phone number...");
      await sendOTP();  
    } catch (err) {
      console.error(err);
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefefe] p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-4">
          Create your account
        </h2>

        <form className="space-y-4" onSubmit={handleSignup}>
          <input
            className="w-full border border-gray-300 rounded-lg p-3"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            className="w-full border border-gray-300 rounded-lg p-3 "
            name="rollNumber"
            placeholder="Roll Number (CAPITAL)"
            value={formData.rollNumber}
            onChange={handleChange}
            required
          />
          <input
            className="w-full border border-gray-300 rounded-lg p-3 "
            name="hostel"
            placeholder="Hostel Name"
            value={formData.hostel}
            onChange={handleChange}
            required
          />
          <input
            className="w-full border border-gray-300 rounded-lg p-3 "
            name="roomNumber"
            placeholder="Room Number"
            value={formData.roomNumber}
            onChange={handleChange}
            required
          />
          <input
            className="w-full border border-gray-300 rounded-lg p-3 "
            name="mobile"
            placeholder="Mobile Number"
            type="tel"
            value={formData.mobile}
            onChange={handleChange}
            required
          />

        
          <div className="relative">
            <input
              className="w-full border border-gray-300 rounded-lg p-3 pr-12"
              name="password"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {otpSent && (
            <div className="space-y-2">
              <input
                className="w-full border border-gray-300 rounded-lg p-3"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button
                type="button"
                onClick={verifyOTP}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg"
              >
                Verify OTP
              </button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f7c346] hover:bg-[#f5b900] text-white font-semibold py-3 rounded-lg shadow-md"
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Already registered?{" "}
          <Link to="/login" className="text-green-600 hover:underline">
            Login here
          </Link>
        </p>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}

